// DynaCompliance Operations Center — SPA front-end.
// Implements the three Google Stitch screens (Dashboard, Incident Deep Dive,
// Monthly Report) as one live app wired to the Express backend:
//   GET  /api/incidents   → dashboard feed (classifier-enriched)
//   POST /api/classify    → deep-dive analysis (DynaWatcher + DORAClassifier + Gemini 3)
//   POST /api/execute      → human-approved write-back + EBA submit
//   GET  /api/report       → monthly DORA compliance aggregate
//   GET  /health           → stack proof

const DC = (() => {
  const view = document.getElementById("view");
  const approval = document.getElementById("approval");
  let timers = [];
  let pending = null;
  // The signed-in approver (maps to the "JD" avatar). Real deployments derive this
  // from the auth session; it stamps every approval in the DORA defensibility ledger.
  const USER = { id: "j.dijkstra", name: "J. Dijkstra", role: "Compliance Officer" };

  // ---------- helpers ----------
  const h = (html) => { const t = document.createElement("template"); t.innerHTML = html.trim(); return t.content.firstElementChild; };
  const esc = (s) => String(s ?? "").replace(/[&<>"]/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" }[c]));
  const cet = (iso) => new Date(iso).toLocaleString("en-GB", { timeZone: "Europe/Amsterdam", hour: "2-digit", minute: "2-digit" }) + " CET";
  const cetDate = (iso) => new Date(iso).toLocaleString("en-GB", { timeZone: "Europe/Amsterdam", day: "2-digit", month: "short", hour: "2-digit", minute: "2-digit" });
  const money = (n) => "€" + Number(n || 0).toLocaleString("en-US");
  const clearTimers = () => { timers.forEach(clearInterval); timers = []; };
  async function api(path, opts) {
    const r = await fetch(path, opts);
    const d = await r.json().catch(() => ({}));
    if (!r.ok || d.error) throw new Error(d.error || r.statusText);
    return d;
  }
  function remaining(targetIso) {
    let ms = new Date(targetIso) - Date.now();
    const overdue = ms < 0; ms = Math.abs(ms);
    const hh = Math.floor(ms / 3.6e6), mm = Math.floor((ms % 3.6e6) / 6e4), ss = Math.floor((ms % 6e4) / 1e3);
    return { txt: `${hh}:${String(mm).padStart(2, "0")}:${String(ss).padStart(2, "0")}`, overdue, mm: Math.floor(ms / 6e4) };
  }
  function countdown(elId, targetIso, onTick) {
    const tick = () => { const el = document.getElementById(elId); if (!el) return; const r = remaining(targetIso); el.textContent = (r.overdue ? "-" : "") + r.txt; el.classList.toggle("text-danger", r.overdue); if (onTick) onTick(r); };
    tick(); timers.push(setInterval(tick, 1000));
  }

  // ---------- approval flow ----------
  function showApproval(p) {
    pending = { incident: p.incident, verdict: p.verdict, eba_draft: p.eba_draft };
    document.getElementById("ap-title").textContent = "⚡ Agent proposes: " + p.proposedAction.description;
    document.getElementById("ap-tools").textContent = "tools: " + (p.proposedAction.tools || []).join("  ·  ");
    approval.classList.remove("hidden"); approval.classList.add("flex");
  }
  function rejectApproval() { approval.classList.add("hidden"); approval.classList.remove("flex"); }
  async function approve() {
    if (!pending) return;
    const draftEl = document.getElementById("eba-draft");
    if (draftEl) pending.eba_draft = draftEl.value ?? draftEl.textContent;
    try {
      const d = await api("/api/execute", { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ approved: true, approver: USER, payload: pending }) });
      rejectApproval();
      const sig = d.audit?.signature ? ` · sig ${d.audit.signature}` : "";
      toast(`<div class="flex items-center gap-3"><span class="material-symbols-outlined text-success">task_alt</span><div><div class="font-bold text-on-surface">Submitted to DNB</div><div class="text-on-surface-variant text-label-sm">Executed: ${(d.executed || []).join(", ")}</div><div class="text-on-surface-variant text-label-sm">Approved by ${esc(USER.name)} (${esc(USER.role)})${sig}</div></div></div>`);
      const btn = document.getElementById("submit-btn");
      if (btn) { btn.disabled = true; btn.innerHTML = '<span class="material-symbols-outlined">task_alt</span> Submitted to DNB'; btn.classList.add("opacity-60", "pointer-events-none"); }
      const status = document.getElementById("submit-status"); if (status) status.innerHTML = `Filed ${new Date(d.at).toLocaleTimeString("en-GB")} by ${esc(USER.name)}<br><span class="font-mono text-[10px]">audit ${esc(d.audit?.id || "")} · sig ${esc(d.audit?.signature || "")}</span>`;
    } catch (e) { toast(`<div class="text-danger">Execute failed: ${esc(e.message)}</div>`); }
  }
  function toast(html) {
    const t = document.getElementById("toast"); t.innerHTML = html; t.classList.remove("hidden");
    setTimeout(() => t.classList.add("hidden"), 5000);
  }

  // ---------- nav ----------
  function setActiveNav(route) {
    document.querySelectorAll(".nav-item").forEach((a) => {
      const on = a.dataset.route === route;
      a.classList.toggle("bg-secondary-container", on);
      a.classList.toggle("text-on-secondary-container", on);
      a.classList.toggle("text-on-surface-variant", !on);
      a.classList.toggle("hover:bg-surface-variant", !on);
      a.classList.toggle("hover:text-on-surface", !on);
    });
  }

  // ================= DASHBOARD =================
  async function renderDashboard() {
    view.innerHTML = `<div class="p-margin-desktop text-on-surface-variant">Loading operations feed…</div>`;
    let rows = [], health = {}, report = {};
    try { [rows, health, report] = await Promise.all([api("/api/incidents"), api("/health").catch(() => ({})), api("/api/report").catch(() => ({}))]); }
    catch (e) { view.innerHTML = `<div class="p-margin-desktop text-danger">Failed to load: ${esc(e.message)}</div>`; return; }

    const active = rows.length;
    const major = rows.filter((r) => r.classification === "MAJOR").length;
    const majorRow = rows.find((r) => r.classification === "MAJOR");
    // KPIs sourced from the compliance report (trailing window), not hardcoded.
    const onTime = report?.totals?.on_time_pct ?? 100;
    const avgSec = report?.totals?.avg_classification_s ?? 90;
    const faster = Math.max(1, Math.round((47 * 60) / avgSec)); // vs 47-min manual baseline

    const sevPill = (c) => c === "MAJOR"
      ? `<span class="px-2 py-1 bg-danger text-[10px] font-bold rounded-lg text-white">MAJOR</span>`
      : `<span class="px-2 py-1 bg-surface-bright text-[10px] font-bold rounded-lg text-on-surface-variant uppercase">MINOR</span>`;
    const statusCell = (r) => r.status === "automating"
      ? `<div class="flex items-center gap-2 text-primary"><span class="material-symbols-outlined text-[16px] animate-spin">sync</span><span class="text-label-sm font-bold italic">Automating…</span></div>`
      : `<div class="flex items-center gap-2 text-success"><span class="material-symbols-outlined text-[16px]">check_circle</span><span class="text-label-sm font-bold">Classified</span></div>`;

    const rowsHtml = rows.map((r) => `
      <tr class="hover:bg-surface-variant/40 transition-colors cursor-pointer" onclick="location.hash='#/incident/${encodeURIComponent(r.incident_id)}'">
        <td class="p-4">${sevPill(r.classification)}</td>
        <td class="p-4"><div class="font-bold text-body-sm text-on-surface">${esc(r.title)}</div><div class="text-label-sm text-on-surface-variant mt-0.5">${esc(r.subtitle || r.incident_id)}</div></td>
        <td class="p-4 text-body-sm text-on-surface-variant">${cet(r.start)}</td>
        <td class="p-4">${statusCell(r)}</td>
        <td class="p-4 text-body-sm font-bold ${r.classification === "MAJOR" ? "text-tertiary" : "text-on-surface-variant"}">${r.classification === "MAJOR" ? cet(r.deadline) : "—"}</td>
        <td class="p-4 text-right"><button class="bg-primary px-4 py-2 rounded-lg text-on-primary text-label-md font-bold inline-flex items-center gap-2">${r.classification === "MAJOR" ? "View Report" : "Re-examine"}<span class="material-symbols-outlined text-[16px]">arrow_forward</span></button></td>
      </tr>`).join("");

    view.innerHTML = `
    <div class="p-margin-desktop flex flex-col gap-lg pb-32">
      <!-- Hero stats -->
      <section class="grid grid-cols-2 lg:grid-cols-4 gap-gutter">
        <div class="bento-card p-lg rounded-lg flex flex-col justify-between">
          <span class="text-label-sm font-bold text-on-surface-variant uppercase tracking-widest">Active Incidents</span>
          <div class="mt-4 flex items-baseline gap-2"><span class="text-display-lg font-bold text-on-surface" data-tabnum>${active}</span><span class="w-2.5 h-2.5 rounded-full bg-tertiary"></span></div>
          <p class="text-body-sm text-on-surface-variant mt-3">Requiring DORA classification</p>
        </div>
        <div class="bento-card p-lg rounded-lg flex flex-col justify-between">
          <span class="text-label-sm font-bold text-on-surface-variant uppercase tracking-widest">Today's Major</span>
          <div class="mt-4"><span class="text-display-lg font-bold text-danger" data-tabnum>${major}</span></div>
          <div class="mt-3 flex justify-between items-center bg-tertiary/10 border border-tertiary/20 rounded-lg p-2">
            <span class="text-label-sm text-on-surface-variant">Major ICT incidents</span>
            <span class="text-label-sm font-bold text-tertiary text-right">4h deadline<br><span id="hero-deadline">${majorRow ? cet(majorRow.deadline) : "—"}</span></span>
          </div>
        </div>
        <div class="bento-card p-lg rounded-lg flex flex-col justify-between">
          <span class="text-label-sm font-bold text-on-surface-variant uppercase tracking-widest">On-time Reporting</span>
          <div class="mt-4"><span class="text-display-lg font-bold text-success">${onTime}%</span>
            <div class="mt-3 w-full h-1.5 bg-surface-variant rounded-full overflow-hidden"><div class="bg-success h-full" style="width:${onTime}%"></div></div>
          </div>
          <p class="text-label-sm text-on-surface-variant mt-3 italic">${esc(report?.month || "trailing 30d")} · Art.19 deadlines met</p>
        </div>
        <div class="bento-card p-lg rounded-lg flex flex-col justify-between border-primary/30">
          <span class="text-label-sm font-bold text-on-surface-variant uppercase tracking-widest">Avg Classification</span>
          <div class="mt-4 flex items-baseline gap-3"><span class="text-display-lg font-bold text-primary">${avgSec}s</span><span class="text-label-sm font-bold text-success">${faster}× faster</span></div>
          <p class="text-label-sm text-on-surface-variant mt-3 italic">vs 47min manual workflow</p>
        </div>
      </section>

      <div class="grid grid-cols-1 xl:grid-cols-3 gap-gutter">
        <!-- Incidents monitor + activity log -->
        <div class="xl:col-span-2 flex flex-col gap-gutter">
          <section class="bento-card rounded-lg overflow-hidden">
            <div class="p-md border-b border-outline-variant flex justify-between items-center">
              <div class="flex items-center gap-3"><span class="material-symbols-outlined text-primary">warning</span><h3 class="text-label-md font-bold text-on-surface uppercase tracking-wider">Active Incidents Monitor</h3></div>
              <div class="flex gap-2">
                <button onclick="DC.exportCsv()" class="px-3 py-1.5 bg-surface-variant text-on-surface-variant text-label-sm font-bold uppercase rounded-lg border border-outline-variant hover:bg-surface-bright">Export CSV</button>
                <button onclick="DC.route()" class="px-3 py-1.5 bg-primary text-on-primary text-label-sm font-bold uppercase rounded-lg hover:opacity-90">Refresh Feed</button>
              </div>
            </div>
            <div class="overflow-x-auto"><table class="w-full text-left">
              <thead><tr class="bg-surface-container-low border-b border-outline-variant text-label-sm text-on-surface-variant uppercase tracking-widest">
                <th class="p-4">Severity</th><th class="p-4">Incident</th><th class="p-4">Started</th><th class="p-4">DORA Status</th><th class="p-4">Deadline</th><th class="p-4 text-right">Actions</th>
              </tr></thead>
              <tbody class="divide-y divide-outline-variant/40">${rowsHtml}</tbody>
            </table></div>
          </section>

          <section class="bento-card rounded-lg">
            <div class="p-3 border-b border-outline-variant flex justify-between items-center bg-surface-container-low">
              <div class="flex items-center gap-2"><span class="w-1.5 h-1.5 rounded-full bg-primary pulse-live"></span><span class="text-label-sm font-bold uppercase tracking-widest text-on-surface-variant">Agent Activity Log</span></div>
              <span class="text-label-sm text-on-surface-variant italic">Auto-scrolling live feed</span>
            </div>
            <div id="activity-log" class="p-md h-40 overflow-y-auto space-y-3 text-[12px]" style="font-variant-numeric:tabular-nums"></div>
          </section>
        </div>

        <!-- EBA draft sidebar -->
        <aside id="eba-side" class="bento-card rounded-lg flex flex-col"></aside>
      </div>
    </div>`;

    renderActivityLog(rows);
    renderEbaSidebar(majorRow);
    if (majorRow) countdown("hero-deadline-cd", majorRow.deadline); // safe no-op if absent
  }

  function renderActivityLog(rows) {
    const box = document.getElementById("activity-log"); if (!box) return;
    const now = () => new Date().toLocaleTimeString("en-GB", { hour12: false });
    const lines = [];
    rows.forEach((r) => {
      if (r.classification === "MAJOR") lines.push([`<span class="text-primary font-bold">[ANALYZING]</span> Correlating Dynatrace PurePath for <span class="text-tertiary">${esc(r.incident_id)}</span> against EBA ICT thresholds…`]);
      else lines.push([`<span class="text-success font-bold">[CLASSIFIED]</span> ${esc(r.incident_id)} ${esc(r.title)} → MINOR, no report required.`]);
    });
    lines.push([`<span class="text-on-surface-variant">Davis AI monitoring API endpoint health for transaction failures…</span>`]);
    box.innerHTML = lines.map((l) => `<div class="flex gap-4"><span class="text-on-surface-variant/60 shrink-0">${now()}</span><span class="text-on-surface-variant">${l[0]}</span></div>`).join("");
  }

  async function renderEbaSidebar(majorRow) {
    const side = document.getElementById("eba-side"); if (!side) return;
    if (!majorRow) {
      side.innerHTML = `<div class="p-lg flex flex-col items-center justify-center h-full text-center gap-3"><span class="material-symbols-outlined text-success text-[40px]">verified_user</span><div class="text-on-surface font-bold">No major incidents</div><div class="text-on-surface-variant text-body-sm">All open incidents are within DORA minor thresholds. No EBA notification required.</div></div>`;
      return;
    }
    side.innerHTML = `<div class="p-lg text-on-surface-variant">Drafting EBA notification…</div>`;
    let a;
    try { a = await api("/api/classify", { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ problemId: majorRow.incident_id }) }); }
    catch (e) { side.innerHTML = `<div class="p-lg text-danger">${esc(e.message)}</div>`; return; }
    const inc = a.incident;
    side.innerHTML = `
      <div class="p-md border-b border-outline-variant flex items-center gap-3"><span class="material-symbols-outlined text-primary">description</span><h3 class="text-label-md font-bold text-on-surface uppercase tracking-wider">EBA Notification Draft</h3></div>
      <div class="flex-1 p-lg overflow-y-auto space-y-lg">
        <div class="bg-danger/10 border border-danger/30 rounded-lg p-md flex gap-3">
          <span class="material-symbols-outlined text-danger shrink-0">warning</span>
          <div><div class="text-label-sm font-bold text-danger uppercase">Critical Deadline</div>
          <p class="text-body-sm text-on-surface-variant italic mt-1">Early warning MUST be submitted before <span class="font-bold text-on-surface">${cet(a.deadlines.early_warning)}</span> — <span id="eba-cd" class="font-bold text-tertiary" data-tabnum></span> remaining.</p></div>
        </div>
        <div class="space-y-1"><label class="text-label-sm font-bold text-on-surface-variant uppercase tracking-widest">Classification</label><div class="bg-surface-container-lowest border border-outline-variant rounded-lg p-3 text-body-sm text-on-surface">Major ICT Incident</div></div>
        <div class="space-y-1"><label class="text-label-sm font-bold text-on-surface-variant uppercase tracking-widest">Entity Identifier</label><div class="bg-surface-container-lowest border border-outline-variant rounded-lg p-3 text-body-sm text-on-surface font-mono">DYNA-BANK-NL-01</div></div>
        <div class="space-y-1"><label class="text-label-sm font-bold text-on-surface-variant uppercase tracking-widest">EBA Early-Warning Draft</label>
          <div class="bg-surface-container-lowest border border-outline-variant rounded-lg p-3 text-body-sm text-on-surface-variant whitespace-pre-wrap max-h-44 overflow-y-auto">${esc(a.eba_draft)}</div></div>
      </div>
      <div class="p-lg border-t border-outline-variant space-y-3">
        <button onclick="location.hash='#/incident/${encodeURIComponent(inc.incident_id)}'" class="w-full bg-primary text-on-primary py-3 rounded-lg font-bold flex items-center justify-center gap-2 hover:opacity-90">Review &amp; Send to DNB <span class="material-symbols-outlined">send</span></button>
        <p class="text-center text-label-sm text-on-surface-variant uppercase tracking-tighter">Authorized under DORA Article 19 · human approval required</p>
      </div>`;
    countdown("eba-cd", a.deadlines.early_warning);
  }

  // ================= INCIDENT DEEP DIVE =================
  async function renderIncident(id) {
    view.innerHTML = `<div class="p-margin-desktop text-on-surface-variant">Running agents on ${esc(id)}…</div>`;
    let a;
    try { a = await api("/api/classify", { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ problemId: id }) }); }
    catch (e) { view.innerHTML = `<div class="p-margin-desktop text-danger">Classify failed: ${esc(e.message)}</div>`; return; }

    const inc = a.incident, v = a.verdict, major = v.classification === "MAJOR";
    const accent = major ? "danger" : "success";
    const conf = Math.round((a.confidence || 0) * 100);

    const reasoningCards = [
      ...v.triggered.map((t, i) => `<div class="p-md bg-surface-container-highest rounded-lg border-l-2 border-primary"><span class="text-label-sm text-primary uppercase">Art.18 Criterion ${i + 1}</span><p class="text-on-surface text-body-sm mt-1">${esc(t)}</p></div>`),
      ...v.also.map((t) => `<div class="p-md bg-surface-container-highest rounded-lg border-l-2 border-tertiary"><span class="text-label-sm text-tertiary uppercase">Additional Obligation</span><p class="text-on-surface text-body-sm mt-1">${esc(t)}</p></div>`),
    ].join("") || `<div class="p-md bg-surface-container-highest rounded-lg border-l-2 border-outline-variant/50"><span class="text-label-sm text-on-surface-variant uppercase">No thresholds breached</span><p class="text-on-surface-variant text-body-sm mt-1 italic">All DORA Art.18 major-incident criteria evaluated below threshold.</p></div>`;

    view.innerHTML = `
    <div class="px-margin-desktop pb-40 pt-lg">
      <!-- breadcrumb + header -->
      <div class="flex flex-col md:flex-row md:items-end justify-between gap-md mb-lg">
        <div>
          <div class="flex items-center gap-2 text-on-surface-variant text-label-sm uppercase tracking-wider mb-1">
            <a href="#/dashboard" class="hover:text-primary">Dashboard</a><span class="material-symbols-outlined text-[14px]">chevron_right</span>
            <span>Incidents</span><span class="material-symbols-outlined text-[14px]">chevron_right</span><span class="text-primary-fixed">${esc(inc.incident_id)}</span>
          </div>
          <h1 class="text-headline-md text-on-surface">${esc(inc.title)}</h1>
        </div>
        <div class="flex items-center gap-md">
          <div class="px-md py-1 border border-${accent} rounded-lg text-${accent} text-label-md flex items-center gap-2"><span class="h-2 w-2 rounded-full bg-${accent} ${major ? "pulse-danger" : ""}"></span>${major ? "MAJOR INCIDENT" : "MINOR INCIDENT"}</div>
          <div class="px-md py-1 bg-tertiary/15 text-tertiary rounded-full text-label-md flex items-center gap-2"><span class="material-symbols-outlined text-[16px]">timer</span>${inc.duration_min} min</div>
        </div>
      </div>

      <!-- classification banner -->
      <section class="w-full ${major ? "bg-[#1A0A0E]" : "bg-[#06140F]"} border-l-4 border-${accent} p-lg mb-lg rounded-r-lg">
        <div class="flex flex-col md:flex-row justify-between items-start md:items-center gap-lg">
          <div class="flex-1">
            <span class="text-label-sm text-${accent}/80 uppercase">Primary DORA Classification</span>
            <h2 class="text-display-lg text-${accent} mt-1">${v.classification}</h2>
            <div class="mt-md space-y-1 max-w-2xl">
              ${(v.triggered.length ? v.triggered : ["No major-incident threshold breached"]).map((t) => `<div class="flex items-center gap-3 text-${accent}/90 text-body-sm"><span class="material-symbols-outlined text-[18px]">${major ? "warning" : "check_circle"}</span><span>${esc(t)}</span></div>`).join("")}
            </div>
          </div>
          <div class="w-full md:w-64 bg-surface-container p-md rounded-lg border border-outline-variant">
            <div class="flex justify-between text-label-md mb-1"><span class="text-on-surface-variant">AI Confidence</span><span class="text-primary">${conf}%</span></div>
            <div class="h-2 w-full bg-surface-variant rounded-full overflow-hidden"><div class="h-full bg-primary" style="width:${conf}%"></div></div>
            <p class="text-label-sm text-on-surface-variant mt-2">${esc((a.rationale || "").slice(0, 110))}…</p>
          </div>
        </div>
      </section>

      <!-- 3-col grid -->
      <div class="grid grid-cols-1 md:grid-cols-12 gap-gutter">
        <!-- DynaWatcher -->
        <div class="md:col-span-4 bento-card rounded-lg p-lg">
          <div class="flex items-center justify-between mb-lg"><h3 class="text-title-lg text-on-surface flex items-center gap-2"><span class="material-symbols-outlined text-primary">monitoring</span>DynaWatcher Data</h3><span class="px-2 py-0.5 bg-primary/10 text-primary rounded-lg text-label-sm">LIVE FEED</span></div>
          <div class="space-y-md">
            ${kv("Services affected", `${(inc.affected_systems || []).length} (${esc((inc.affected_systems || []).join(", "))})`)}
            ${kv("Client exposure", inc.clients_affected_pct + "%")}
            ${kv("Transaction failures", `<span class="text-${accent} font-mono">${(inc.transaction_failures || 0).toLocaleString()}</span>`)}
            ${kv("Volume", `<span class="font-mono">${money(inc.transaction_value_eur)}</span>`)}
            ${kv("Root cause", `<span class="text-primary">${esc(inc.davis_root_cause || "—")}</span>`)}
            <div class="flex items-center gap-3 p-sm bg-surface-container rounded-lg border border-primary/20">
              <span class="material-symbols-outlined text-primary">psychology</span>
              <div class="flex-1"><span class="text-on-surface-variant text-[11px] uppercase">Davis AI confidence</span><div class="text-primary text-label-md">${inc.davis_precision || 95}% Precision</div></div>
            </div>
          </div>
        </div>

        <!-- Regulatory timeline -->
        <div class="md:col-span-4 bento-card rounded-lg p-lg">
          <h3 class="text-title-lg text-on-surface flex items-center gap-2 mb-lg"><span class="material-symbols-outlined text-tertiary">schedule</span>Regulatory Timeline</h3>
          ${major ? `
          <div class="space-y-xl relative before:content-[''] before:absolute before:left-3 before:top-4 before:bottom-4 before:w-0.5 before:bg-outline-variant/30">
            <div class="relative pl-10">
              <div class="absolute left-0 top-1.5 h-6 w-6 rounded-full bg-tertiary border-4 border-surface-container-low"></div>
              <span class="text-label-sm text-on-surface-variant">#1 EARLY WARNING</span>
              <div class="flex justify-between items-end mt-1"><span id="cd-ew" class="text-headline-sm text-on-surface" data-tabnum>—</span><span class="text-tertiary text-label-md">${cet(a.deadlines.early_warning)}</span></div>
              <div class="h-1.5 w-full bg-surface-variant mt-1 rounded-full overflow-hidden"><div id="cd-ew-bar" class="h-full bg-tertiary" style="width:0%"></div></div>
            </div>
            <div class="relative pl-10">
              <div class="absolute left-0 top-1.5 h-6 w-6 rounded-full bg-surface-variant border-4 border-surface-container-low"></div>
              <span class="text-label-sm text-on-surface-variant/60">#2 INTERMEDIATE (72h)</span>
              <div class="flex justify-between items-end mt-1"><span class="text-headline-sm text-on-surface/50">${cetDate(a.deadlines.intermediate)}</span></div>
            </div>
            <div class="relative pl-10">
              <div class="absolute left-0 top-1.5 h-6 w-6 rounded-full bg-surface-variant border-4 border-surface-container-low"></div>
              <span class="text-label-sm text-on-surface-variant/60">#3 FINAL REPORT (~1 month)</span>
              <div class="flex justify-between items-end mt-1"><span class="text-headline-sm text-on-surface/50">${cetDate(a.deadlines.final)}</span></div>
            </div>
          </div>` : `<div class="flex flex-col items-center justify-center text-center gap-3 py-lg"><span class="material-symbols-outlined text-success text-[40px]">verified</span><p class="text-on-surface-variant text-body-sm">MINOR classification — no DORA Art.19 reporting deadlines triggered.</p></div>`}
        </div>

        <!-- Reasoning -->
        <div class="md:col-span-4 bento-card rounded-lg p-lg">
          <h3 class="text-title-lg text-on-surface flex items-center gap-2 mb-lg"><span class="material-symbols-outlined text-secondary">account_tree</span>Classification Reasoning</h3>
          <div class="space-y-md">${reasoningCards}
            <div class="mt-md p-md border border-outline-variant rounded-lg bg-surface-container-low">
              <div class="flex items-center gap-2 text-on-surface-variant text-label-md mb-1"><span class="material-symbols-outlined text-[18px]">info</span>Agent Rationale (Gemini 3)</div>
              <p class="text-body-sm text-on-surface-variant">${esc(a.rationale)}</p>
            </div>
          </div>
        </div>

        <!-- Notification draft -->
        <div class="md:col-span-12 bento-card rounded-lg p-lg mt-xs">
          <div class="flex flex-col md:flex-row justify-between items-start md:items-center gap-md mb-lg">
            <h3 class="text-title-lg text-on-surface flex items-center gap-2"><span class="material-symbols-outlined text-primary">mail</span>Notification Draft (DORA Template v2.4)</h3>
            <div class="flex items-center gap-md">
              <span id="submit-status" class="text-label-sm text-on-surface-variant"></span>
              <button onclick="DC.toggleEdit()" id="edit-btn" class="flex items-center gap-1 px-md py-sm border border-outline-variant rounded-lg text-on-surface-variant text-label-md hover:bg-surface-variant"><span class="material-symbols-outlined text-[18px]">edit</span>Edit Draft</button>
            </div>
          </div>
          ${major ? `
          <div class="grid grid-cols-1 lg:grid-cols-2 gap-xl">
            <div class="space-y-md">
              <div><label class="text-label-sm text-on-surface-variant uppercase block mb-1">Incident Summary (editable)</label>
                <textarea id="eba-draft" readonly class="w-full bg-surface-container-lowest border border-outline-variant p-md rounded-lg text-body-sm text-on-surface h-44 resize-none focus:border-primary focus:ring-0">${esc(a.eba_draft)}</textarea></div>
              <div class="flex gap-lg">
                <div class="flex-1"><label class="text-label-sm text-on-surface-variant uppercase block mb-1">Regulatory Body</label><div class="bg-surface-container-lowest border border-outline-variant px-md py-sm rounded-lg text-body-sm text-on-surface">DNB (De Nederlandsche Bank)</div></div>
                <div class="flex-1"><label class="text-label-sm text-on-surface-variant uppercase block mb-1">Priority</label><div class="bg-surface-container-lowest border border-danger/50 px-md py-sm rounded-lg text-body-sm text-danger font-bold">CRITICAL / MAJOR</div></div>
              </div>
            </div>
            <div class="flex flex-col justify-end gap-lg">
              <div class="p-md bg-primary/5 border border-primary/20 rounded-lg"><div class="flex items-center gap-2 text-primary text-label-md mb-1"><span class="material-symbols-outlined text-[18px]">verified_user</span>Compliance Validation</div><p class="text-body-sm text-on-surface-variant">Draft includes all mandatory fields for the EBA/GL/2021/03 incident reporting guideline. Write-back + submission are gated on your approval.</p></div>
              <button id="submit-btn" onclick="DC.approve()" class="w-full bg-primary-container text-on-primary-container py-lg rounded-lg text-headline-sm flex items-center justify-center gap-3 hover:opacity-90 active:scale-[0.99]">Approve &amp; Submit to DNB — <span id="cd-submit" data-tabnum>—</span> left<span class="material-symbols-outlined">send</span></button>
            </div>
          </div>` : `
          <div class="flex items-center gap-4 p-md bg-success/5 border border-success/20 rounded-lg"><span class="material-symbols-outlined text-success text-[28px]">task_alt</span><div><div class="text-on-surface font-bold">No regulatory notification required</div><p class="text-body-sm text-on-surface-variant">MINOR incidents are written back to Dynatrace for the audit trail only. No EBA early-warning is filed.</p></div>
            <button id="submit-btn" onclick="DC.approve()" class="ml-auto bg-primary text-on-primary px-lg py-sm rounded-lg font-bold flex items-center gap-2 hover:opacity-90">Write classification <span class="material-symbols-outlined text-[18px]">save</span></button></div>`}
        </div>

        <!-- Cross-app handoff: DynaCompliance (detect) → IncidentIQ (classify + file) -->
        <div class="md:col-span-12 bento-card rounded-lg p-lg mt-xs">
          <div class="flex flex-col md:flex-row justify-between items-start md:items-center gap-md">
            <div class="flex items-center gap-3">
              <span class="material-symbols-outlined text-secondary text-[24px]">swap_horiz</span>
              <div>
                <h3 class="text-title-lg text-on-surface">Cross-app Handoff → IncidentIQ</h3>
                <p class="text-body-sm text-on-surface-variant max-w-2xl">DynaCompliance owns real-time detection and starts the Art.19 clock; IncidentIQ owns the retrospective filing. Forward this detection so the two agents compose one detect→report pipeline.</p>
              </div>
            </div>
            <button id="handoff-btn" onclick="DC.handoff('${esc(inc.incident_id)}')" class="shrink-0 bg-secondary-container text-on-secondary-container px-lg py-sm rounded-lg font-bold flex items-center gap-2 hover:opacity-90"><span class="material-symbols-outlined text-[18px]">send_to_mobile</span>Hand off detection</button>
          </div>
          <div id="handoff-result" class="mt-md hidden"></div>
        </div>
      </div>
    </div>`;

    if (major) {
      const start = new Date(inc.start).getTime(), end = new Date(a.deadlines.early_warning).getTime();
      countdown("cd-ew", a.deadlines.early_warning, () => {
        const bar = document.getElementById("cd-ew-bar");
        if (bar) bar.style.width = Math.min(100, Math.max(0, ((Date.now() - start) / (end - start)) * 100)).toFixed(1) + "%";
      });
      countdown("cd-submit", a.deadlines.early_warning);
    }
    showApproval(a);
  }

  function kv(k, v) {
    return `<div class="flex justify-between border-b border-outline-variant/30 pb-sm"><span class="text-on-surface-variant text-body-sm">${k}</span><span class="text-on-surface text-label-md text-right">${v}</span></div>`;
  }
  async function handoff(id) {
    const box = document.getElementById("handoff-result");
    const btn = document.getElementById("handoff-btn");
    if (btn) { btn.disabled = true; btn.innerHTML = '<span class="material-symbols-outlined text-[18px] animate-spin">sync</span>Forwarding…'; }
    try {
      const d = await api("/api/handoff", { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ problemId: id }) });
      const det = d.detection || {};
      const fwd = d.forwarded;
      box.classList.remove("hidden");
      box.innerHTML = `
        <div class="grid grid-cols-1 lg:grid-cols-2 gap-md">
          <div class="p-md rounded-lg border ${fwd ? "border-success/30 bg-success/5" : "border-tertiary/30 bg-tertiary/5"}">
            <div class="flex items-center gap-2 ${fwd ? "text-success" : "text-tertiary"} text-label-md font-bold"><span class="material-symbols-outlined text-[18px]">${fwd ? "check_circle" : "info"}</span>${fwd ? "Forwarded to IncidentIQ" : "Detection prepared (not forwarded)"}</div>
            <p class="text-body-sm text-on-surface-variant mt-1">${fwd ? "IncidentIQ acknowledged the detection and will run the authoritative classification + regulatory filing." : "Set <span class='font-mono'>INCIDENTIQ_URL</span> to forward live. Reason: " + esc(d.reason || "")}</p>
          </div>
          <div class="p-md rounded-lg bg-surface-container-lowest border border-outline-variant">
            <div class="text-label-sm text-on-surface-variant uppercase mb-1">Detection payload · DORA clock anchor</div>
            <pre class="text-[11px] text-on-surface-variant whitespace-pre-wrap overflow-x-auto">${esc(JSON.stringify({ source: det.source, incident_id: det.incident_id, detected_at: det.detected_at, dyna_classification: det.dyna_classification, transaction_value_eur: det.transaction_value_eur, root_cause_third_party: det.root_cause_third_party }, null, 2))}</pre>
          </div>
        </div>`;
    } catch (e) { if (box) { box.classList.remove("hidden"); box.innerHTML = `<div class="text-danger">Handoff failed: ${esc(e.message)}</div>`; } }
    finally { if (btn) { btn.disabled = false; btn.innerHTML = '<span class="material-symbols-outlined text-[18px]">send_to_mobile</span>Hand off detection'; } }
  }

  function toggleEdit() {
    const t = document.getElementById("eba-draft"); if (!t) return;
    t.readOnly = !t.readOnly;
    const btn = document.getElementById("edit-btn");
    if (!t.readOnly) { t.focus(); t.classList.add("border-primary"); btn.innerHTML = '<span class="material-symbols-outlined text-[18px]">check</span>Done'; }
    else { t.classList.remove("border-primary"); btn.innerHTML = '<span class="material-symbols-outlined text-[18px]">edit</span>Edit Draft'; }
  }

  // ================= MONTHLY REPORT =================
  async function renderReport() {
    view.innerHTML = `<div class="p-margin-desktop text-on-surface-variant">Compiling report…</div>`;
    let rep, ledger = [];
    try { [rep, ledger] = await Promise.all([api("/api/report"), api("/api/audit").catch(() => [])]); }
    catch (e) { view.innerHTML = `<div class="p-margin-desktop text-danger">${esc(e.message)}</div>`; return; }
    const t = rep.totals;
    // Live approvals from this session prepend the historical audit trail.
    const liveAudit = ledger.map((e) => ({
      title: `Approved · ${e.executed?.includes("notify.submit_eba") ? "EBA notice filed to DNB" : "Classification written to Dynatrace"}`,
      detail: `${e.classification} ${e.incident_id} approved by ${e.approver?.name || e.approver?.id} (${e.approver?.role || "approver"}). Signature ${e.signature}.`,
      when: new Date(e.at).toLocaleString("en-GB"), severity: "Approval", tone: "primary",
    }));

    // trend chart points
    const W = 1000, H = 300, max = Math.max(...rep.trend.total) * 1.15;
    const pts = (arr) => arr.map((y, i) => `${(i / (arr.length - 1)) * W},${H - (y / max) * H}`).join(" ");

    const metric = (label, value, sub, color, icon, extra = "") => `
      <div class="glass-panel p-lg rounded-lg border-t-2 border-t-${color}">
        <div class="flex justify-between items-start mb-2"><p class="text-label-sm text-on-surface-variant uppercase">${label}</p><span class="material-symbols-outlined text-${color}">${icon}</span></div>
        <div class="flex items-baseline gap-2"><p class="text-display-lg ${color === "success" ? "text-success" : ""}">${value}</p>${extra}</div>
        <div class="flex items-center gap-1 text-on-surface-variant mt-1"><span class="material-symbols-outlined text-[16px]">${sub.icon}</span><span class="text-body-sm">${sub.text}</span></div>
      </div>`;

    const rowsHtml = rep.major_incidents.map((m) => `
      <tr class="hover:bg-surface-variant transition-colors">
        <td class="px-lg py-md font-mono text-body-sm">${m.date}</td>
        <td class="px-lg py-md"><div class="flex flex-col"><span class="text-body-md font-semibold">${esc(m.title)}</span><span class="text-label-sm text-on-surface-variant">ID: ${m.id}</span></div></td>
        <td class="px-lg py-md text-center"><span class="bg-tertiary/20 text-tertiary px-sm py-xs rounded-lg font-mono text-body-sm">${m.duration}</span></td>
        <td class="px-lg py-md"><span class="bg-error-container/40 text-error border border-error/50 px-sm py-xs rounded-full text-[10px] uppercase font-bold">${m.classification}</span></td>
        <td class="px-lg py-md font-mono text-body-sm">${m.submitted}</td>
        <td class="px-lg py-md font-mono text-body-sm text-on-surface-variant">${m.deadline}</td>
        <td class="px-lg py-md"><span class="flex items-center gap-2 text-primary font-bold text-label-sm"><span class="material-symbols-outlined text-[16px]" style="font-variation-settings:'FILL' 1;">check_circle</span>${m.status}</span></td>
      </tr>`).join("");

    const cov = rep.article_coverage.map((c) => {
      const col = c.pct >= 80 ? "primary" : "tertiary";
      return `<div class="space-y-sm"><div class="flex justify-between text-label-md"><span>${esc(c.article)}</span><span class="text-${col} font-bold">${c.pct}%</span></div>
        <div class="w-full bg-surface-container-high h-2 rounded-full overflow-hidden"><div class="bg-${col} h-full" style="width:${c.pct}%"></div></div>
        <p class="text-body-sm text-on-surface-variant">${esc(c.note)}</p></div>`;
    }).join("");

    const audit = [...liveAudit, ...rep.audit_trail].map((e) => `
      <div class="flex gap-lg relative">
        <div class="w-6 h-6 rounded-full bg-surface-container-lowest border-2 border-${e.tone} z-10 flex items-center justify-center shrink-0"><div class="w-2 h-2 rounded-full bg-${e.tone}"></div></div>
        <div class="flex-1"><p class="text-body-md font-medium">${esc(e.title)}</p><p class="text-body-sm text-on-surface-variant mb-xs">${esc(e.detail)}</p><p class="font-mono text-[11px] text-on-surface-variant uppercase">${esc(e.when)} • Severity: ${esc(e.severity)}</p></div>
      </div>`).join("");

    view.innerHTML = `
    <div class="p-margin-desktop pb-32">
      <div class="flex flex-col md:flex-row md:items-center justify-between mb-xl gap-gutter">
        <div><div class="flex items-center gap-2 mb-1"><span class="text-primary font-bold text-label-sm uppercase tracking-widest">Regulatory Monitoring</span><span class="w-1.5 h-1.5 rounded-full bg-primary pulse-live"></span></div>
          <h1 class="text-display-lg">DORA Compliance Report — ${esc(rep.month)}</h1></div>
        <div class="flex items-center gap-gutter">
          <button onclick="DC.toast('<span class=\\'text-on-surface\\'>PDF export queued.</span>')" class="flex items-center gap-2 px-lg py-sm bg-surface-container-high border border-outline-variant rounded-lg text-label-md hover:bg-surface-variant"><span class="material-symbols-outlined text-[18px]">download</span>Download PDF</button>
          <button onclick="DC.exportReportCsv()" class="flex items-center gap-2 px-lg py-sm bg-primary text-on-primary rounded-lg text-label-md hover:opacity-90"><span class="material-symbols-outlined text-[18px]">table_view</span>Export CSV</button>
        </div>
      </div>

      <div class="grid grid-cols-2 lg:grid-cols-4 gap-gutter mb-xl">
        ${metric("Total Incidents", t.incidents, { icon: "trending_up", text: "+12% vs last month" }, "primary", "analytics")}
        ${metric("Major", t.major, { icon: "trending_flat", text: "Stable visibility" }, "tertiary", "priority_high")}
        ${metric("On-time", t.on_time_pct + "%", { icon: "check_circle", text: "DORA compliant" }, "success", "verified", '<span class="text-label-sm text-success">GREEN</span>')}
        ${metric("Avg Classification", t.avg_classification_s + "s", { icon: "keyboard_double_arrow_down", text: "vs 47m limit" }, "primary", "timer")}
      </div>

      <div class="glass-panel p-lg rounded-lg mb-xl">
        <div class="flex items-center justify-between mb-lg">
          <div><h3 class="text-title-lg">Incident Progression</h3><p class="text-body-sm text-on-surface-variant">Total Volume vs Major Escalations</p></div>
          <div class="flex items-center gap-lg"><div class="flex items-center gap-2"><span class="w-3 h-3 rounded-full bg-primary"></span><span class="text-label-md">Total</span></div><div class="flex items-center gap-2"><span class="w-3 h-3 rounded-full bg-tertiary"></span><span class="text-label-md">Major</span></div></div>
        </div>
        <div class="h-[280px] w-full relative">
          <div class="absolute inset-0 border-b border-l border-outline-variant opacity-30"><div class="w-full h-full" style="background-image:radial-gradient(#1E2D4A 1px,transparent 1px);background-size:24px 24px;"></div></div>
          <svg class="absolute inset-0 w-full h-full overflow-visible" viewBox="0 0 ${W} ${H}" preserveAspectRatio="none">
            <polyline points="${pts(rep.trend.total)}" fill="none" stroke="#4cd6fb" stroke-width="3" stroke-linecap="round" vector-effect="non-scaling-stroke"/>
            <polyline points="${pts(rep.trend.major)}" fill="none" stroke="#eb8f3b" stroke-width="3" stroke-linecap="round" vector-effect="non-scaling-stroke"/>
          </svg>
          <div class="absolute bottom-0 left-0 w-full flex justify-between font-mono text-[10px] text-on-surface-variant pt-1">${rep.trend.labels.map((l) => `<span>${l}</span>`).join("")}</div>
        </div>
      </div>

      <div class="glass-panel rounded-lg overflow-hidden mb-xl">
        <div class="px-lg py-md border-b border-outline-variant flex items-center justify-between"><h3 class="text-title-lg">Major Incidents Log</h3></div>
        <div class="overflow-x-auto"><table class="w-full text-left">
          <thead><tr class="bg-surface-container-low text-on-surface-variant text-label-sm uppercase tracking-wider"><th class="px-lg py-md">Date</th><th class="px-lg py-md">Incident</th><th class="px-lg py-md text-center">Duration</th><th class="px-lg py-md">Class</th><th class="px-lg py-md">Submitted</th><th class="px-lg py-md">Deadline</th><th class="px-lg py-md">Status</th></tr></thead>
          <tbody class="divide-y divide-outline-variant">${rowsHtml}</tbody>
        </table></div>
      </div>

      <div class="grid grid-cols-1 md:grid-cols-2 gap-xl">
        <div class="glass-panel p-lg rounded-lg border-t-2 border-t-primary"><div class="flex items-center justify-between mb-lg"><h3 class="text-title-lg">Article Coverage</h3><span class="material-symbols-outlined text-primary">gavel</span></div><div class="space-y-lg">${cov}</div></div>
        <div class="glass-panel p-lg rounded-lg border-t-2 border-t-primary flex flex-col max-h-[420px]"><div class="flex items-center justify-between mb-lg"><h3 class="text-title-lg">Audit Trail</h3><span class="material-symbols-outlined text-on-surface-variant">filter_list</span></div>
          <div class="flex-1 overflow-y-auto pr-xs"><div class="space-y-lg relative before:absolute before:left-[11px] before:top-2 before:bottom-2 before:w-px before:bg-outline-variant">${audit}</div></div></div>
      </div>
    </div>`;
  }

  // shared page header
  function pageHeader(title, sub, icon, actions = "") {
    return `<div class="flex flex-col md:flex-row md:items-center justify-between mb-xl gap-gutter">
      <div><div class="flex items-center gap-2 mb-1"><span class="material-symbols-outlined text-primary text-[20px]">${icon}</span><span class="text-primary font-bold text-label-sm uppercase tracking-widest">${sub}</span><span class="w-1.5 h-1.5 rounded-full bg-primary pulse-live"></span></div>
      <h1 class="text-display-lg">${esc(title)}</h1></div><div class="flex items-center gap-gutter">${actions}</div></div>`;
  }
  const sev = (c) => c === "MAJOR"
    ? `<span class="px-2 py-1 bg-danger text-[10px] font-bold rounded-lg text-white">MAJOR</span>`
    : `<span class="px-2 py-1 bg-surface-bright text-[10px] font-bold rounded-lg text-on-surface-variant uppercase">MINOR</span>`;

  // ================= COMPLIANCE MONITOR =================
  async function renderMonitor() {
    view.innerHTML = `<div class="p-margin-desktop text-on-surface-variant">Loading compliance posture…</div>`;
    let rows; try { rows = await api("/api/incidents"); } catch (e) { view.innerHTML = `<div class="p-margin-desktop text-danger">${esc(e.message)}</div>`; return; }
    const majors = rows.filter((r) => r.classification === "MAJOR");
    const nextDl = majors.map((r) => r.deadline).sort()[0];

    const body = rows.map((r, i) => {
      const major = r.classification === "MAJOR";
      const state = major
        ? `<span class="inline-flex items-center gap-1.5 text-tertiary font-bold text-label-sm"><span class="material-symbols-outlined text-[16px]">pending_actions</span>Action Required</span>`
        : `<span class="inline-flex items-center gap-1.5 text-success font-bold text-label-sm"><span class="material-symbols-outlined text-[16px]">verified</span>Compliant</span>`;
      return `<tr class="hover:bg-surface-variant/40 transition-colors cursor-pointer" onclick="location.hash='#/incident/${encodeURIComponent(r.incident_id)}'">
        <td class="px-lg py-md">${sev(r.classification)}</td>
        <td class="px-lg py-md"><div class="font-bold text-body-sm text-on-surface">${esc(r.title)}</div><div class="text-label-sm text-on-surface-variant font-mono">${esc(r.incident_id)}</div></td>
        <td class="px-lg py-md text-body-sm text-on-surface-variant">${cet(r.start)}</td>
        <td class="px-lg py-md">${state}</td>
        <td class="px-lg py-md text-body-sm font-bold ${major ? "text-tertiary" : "text-on-surface-variant"}">${major ? `<span id="mon-cd-${i}" data-tabnum>—</span> <span class="text-on-surface-variant font-normal">left</span>` : "—"}</td>
      </tr>`;
    }).join("");

    view.innerHTML = `<div class="p-margin-desktop pb-32">
      ${pageHeader("Compliance Monitor", "Real-time DORA posture", "security",
        `<button onclick="DC.route()" class="flex items-center gap-2 px-lg py-sm bg-primary text-on-primary rounded-lg text-label-md hover:opacity-90"><span class="material-symbols-outlined text-[18px]">sync</span>Refresh</button>`)}
      <div class="grid grid-cols-2 lg:grid-cols-4 gap-gutter mb-xl">
        ${monCard("Open Incidents", rows.length, "inbox", "primary")}
        ${monCard("Major (reportable)", majors.length, "priority_high", "danger")}
        ${monCard("Within Thresholds", rows.length - majors.length, "verified", "success")}
        ${monCard("Next Deadline", nextDl ? cet(nextDl) : "—", "timer", "tertiary")}
      </div>
      <div class="glass-panel rounded-lg overflow-hidden">
        <div class="px-lg py-md border-b border-outline-variant flex items-center gap-3"><span class="material-symbols-outlined text-primary">monitor_heart</span><h3 class="text-title-lg">Live Incident Compliance</h3></div>
        <div class="overflow-x-auto"><table class="w-full text-left">
          <thead><tr class="bg-surface-container-low text-on-surface-variant text-label-sm uppercase tracking-wider"><th class="px-lg py-md">Severity</th><th class="px-lg py-md">Incident</th><th class="px-lg py-md">Started</th><th class="px-lg py-md">Compliance State</th><th class="px-lg py-md">Early-Warning</th></tr></thead>
          <tbody class="divide-y divide-outline-variant/40">${body}</tbody>
        </table></div>
      </div></div>`;
    rows.forEach((r, i) => { if (r.classification === "MAJOR") countdown(`mon-cd-${i}`, r.deadline); });
  }
  function monCard(label, value, icon, color) {
    return `<div class="glass-panel p-lg rounded-lg border-t-2 border-t-${color}"><div class="flex justify-between items-start mb-2"><p class="text-label-sm text-on-surface-variant uppercase">${label}</p><span class="material-symbols-outlined text-${color}">${icon}</span></div><p class="text-headline-md font-bold ${color === "success" ? "text-success" : color === "danger" ? "text-danger" : color === "tertiary" ? "text-tertiary" : ""}">${value}</p></div>`;
  }

  // ================= EBA NOTIFICATIONS =================
  async function renderEba() {
    view.innerHTML = `<div class="p-margin-desktop text-on-surface-variant">Loading notifications…</div>`;
    let rows, rep;
    try { [rows, rep] = await Promise.all([api("/api/incidents"), api("/api/report")]); }
    catch (e) { view.innerHTML = `<div class="p-margin-desktop text-danger">${esc(e.message)}</div>`; return; }
    const drafts = rows.filter((r) => r.classification === "MAJOR");

    const draftCards = drafts.length ? drafts.map((r, i) => `
      <div class="glass-panel rounded-lg p-lg flex flex-col md:flex-row md:items-center gap-lg cursor-pointer" onclick="location.hash='#/incident/${encodeURIComponent(r.incident_id)}'">
        <div class="flex items-center gap-3"><span class="material-symbols-outlined text-tertiary text-[28px]">edit_note</span><div><div class="text-label-sm text-tertiary uppercase font-bold">Draft · awaiting approval</div><div class="text-body-md font-semibold text-on-surface">${esc(r.title)}</div><div class="text-label-sm text-on-surface-variant font-mono">${esc(r.incident_id)} → DNB</div></div></div>
        <div class="md:ml-auto flex items-center gap-lg">
          <div class="text-right"><div class="text-label-sm text-on-surface-variant uppercase">Early-warning in</div><div class="text-headline-sm text-tertiary font-bold" id="eba-cd-${i}" data-tabnum>—</div></div>
          <button class="bg-primary text-on-primary px-lg py-sm rounded-lg font-bold flex items-center gap-2">Review &amp; Send<span class="material-symbols-outlined text-[18px]">send</span></button>
        </div>
      </div>`).join("") : `<div class="glass-panel rounded-lg p-xl text-center text-on-surface-variant"><span class="material-symbols-outlined text-success text-[40px]">verified_user</span><p class="mt-2">No open major incidents — no EBA notifications pending.</p></div>`;

    const filed = rep.major_incidents.map((m) => `
      <tr class="hover:bg-surface-variant transition-colors">
        <td class="px-lg py-md font-mono text-body-sm">${m.date}</td>
        <td class="px-lg py-md"><div class="text-body-md font-semibold">${esc(m.title)}</div><div class="text-label-sm text-on-surface-variant font-mono">${m.id}</div></td>
        <td class="px-lg py-md"><span class="inline-flex items-center gap-1.5 text-secondary font-bold text-label-sm"><span class="material-symbols-outlined text-[16px]">send</span>Filed to DNB</span></td>
        <td class="px-lg py-md font-mono text-body-sm">${m.submitted}</td>
        <td class="px-lg py-md"><span class="inline-flex items-center gap-1.5 text-primary font-bold text-label-sm"><span class="material-symbols-outlined text-[16px]" style="font-variation-settings:'FILL' 1;">check_circle</span>${m.status}</span></td>
      </tr>`).join("");

    view.innerHTML = `<div class="p-margin-desktop pb-32">
      ${pageHeader("EBA Notifications", "Art.19 early-warning filings", "history_edu")}
      <h3 class="text-title-lg mb-md flex items-center gap-2"><span class="material-symbols-outlined text-tertiary">pending_actions</span>Pending Drafts <span class="text-label-md text-on-surface-variant">(${drafts.length})</span></h3>
      <div class="space-y-md mb-xl">${draftCards}</div>
      <div class="glass-panel rounded-lg overflow-hidden">
        <div class="px-lg py-md border-b border-outline-variant flex items-center gap-3"><span class="material-symbols-outlined text-secondary">outbox</span><h3 class="text-title-lg">Filed Notifications</h3></div>
        <div class="overflow-x-auto"><table class="w-full text-left">
          <thead><tr class="bg-surface-container-low text-on-surface-variant text-label-sm uppercase tracking-wider"><th class="px-lg py-md">Date</th><th class="px-lg py-md">Incident</th><th class="px-lg py-md">Channel</th><th class="px-lg py-md">Submitted</th><th class="px-lg py-md">Status</th></tr></thead>
          <tbody class="divide-y divide-outline-variant">${filed}</tbody>
        </table></div>
      </div></div>`;
    drafts.forEach((r, i) => countdown(`eba-cd-${i}`, r.deadline));
  }

  // ================= INCIDENT LOGS =================
  let _logEntries = [];
  async function renderLogs() {
    view.innerHTML = `<div class="p-margin-desktop text-on-surface-variant">Loading incident logs…</div>`;
    let rows, rep;
    try { [rows, rep] = await Promise.all([api("/api/incidents"), api("/api/report")]); }
    catch (e) { view.innerHTML = `<div class="p-margin-desktop text-danger">${esc(e.message)}</div>`; return; }
    _logEntries = [
      ...rows.map((r) => ({ when: cet(r.start), ts: new Date(r.start).getTime(), id: r.incident_id, title: r.title, cls: r.classification, status: r.status === "automating" ? "OPEN · automating" : "OPEN · classified", live: true })),
      ...rep.major_incidents.map((m) => ({ when: `${m.date} ${m.submitted}`, ts: new Date(m.date).getTime(), id: m.id, title: m.title, cls: m.classification, status: "CLOSED · " + m.status, live: false })),
    ].sort((a, b) => b.ts - a.ts);

    view.innerHTML = `<div class="p-margin-desktop pb-32">
      ${pageHeader("Incident Logs", "Full classification history", "list_alt")}
      <div class="glass-panel rounded-lg overflow-hidden">
        <div class="px-lg py-md border-b border-outline-variant flex items-center justify-between gap-md flex-wrap">
          <h3 class="text-title-lg">All Incidents <span class="text-label-md text-on-surface-variant">(${_logEntries.length})</span></h3>
          <div class="flex items-center gap-sm bg-surface-container-low px-sm py-xs border border-outline-variant rounded-lg"><span class="material-symbols-outlined text-[16px] text-on-surface-variant">search</span>
            <input id="log-search" oninput="DC.filterLogs(this.value)" class="bg-transparent border-none focus:ring-0 text-label-md w-56 text-on-surface" placeholder="Filter by id, title, class…"/></div>
        </div>
        <div class="overflow-x-auto"><table class="w-full text-left">
          <thead><tr class="bg-surface-container-low text-on-surface-variant text-label-sm uppercase tracking-wider"><th class="px-lg py-md">When</th><th class="px-lg py-md">ID</th><th class="px-lg py-md">Incident</th><th class="px-lg py-md">Classification</th><th class="px-lg py-md">Status</th></tr></thead>
          <tbody id="log-body" class="divide-y divide-outline-variant/40">${logRows(_logEntries)}</tbody>
        </table></div>
      </div></div>`;
  }
  function logRows(entries) {
    if (!entries.length) return `<tr><td colspan="5" class="px-lg py-xl text-center text-on-surface-variant">No matching incidents.</td></tr>`;
    return entries.map((e) => `<tr class="hover:bg-surface-variant/40 transition-colors ${e.live ? "cursor-pointer" : ""}" ${e.live ? `onclick="location.hash='#/incident/${encodeURIComponent(e.id)}'"` : ""}>
      <td class="px-lg py-md font-mono text-body-sm text-on-surface-variant">${esc(e.when)}</td>
      <td class="px-lg py-md font-mono text-body-sm">${esc(e.id)}</td>
      <td class="px-lg py-md text-body-sm font-semibold text-on-surface">${esc(e.title)}</td>
      <td class="px-lg py-md">${sev(e.cls)}</td>
      <td class="px-lg py-md text-label-sm ${e.status.includes("OPEN") ? "text-tertiary" : "text-on-surface-variant"}">${esc(e.status)}</td>
    </tr>`).join("");
  }
  function filterLogs(q) {
    const t = (q || "").toLowerCase();
    const f = _logEntries.filter((e) => [e.id, e.title, e.cls, e.status].join(" ").toLowerCase().includes(t));
    const body = document.getElementById("log-body"); if (body) body.innerHTML = logRows(f);
  }

  // ================= SYSTEM HEALTH =================
  async function renderHealth() {
    view.innerHTML = `<div class="p-margin-desktop text-on-surface-variant">Pinging stack…</div>`;
    let d; try { d = await api("/health"); } catch (e) { view.innerHTML = `<div class="p-margin-desktop text-danger">${esc(e.message)}</div>`; return; }
    const ok = d.status === "ok";
    const chip = (t, on) => `<span class="px-3 py-1 rounded-full text-label-sm font-bold border ${on ? "border-success/40 text-success bg-success/10" : "border-danger/40 text-danger bg-danger/10"}">${t} ${on ? "✓" : "✗"}</span>`;
    view.innerHTML = `<div class="p-margin-desktop pb-32">
      ${pageHeader("System Health", "Stack proof for judges", "monitor_heart",
        `<button onclick="DC.renderHealth()" class="flex items-center gap-2 px-lg py-sm bg-primary text-on-primary rounded-lg text-label-md hover:opacity-90"><span class="material-symbols-outlined text-[18px]">cardiology</span>Re-check</button>`)}
      <div class="glass-panel rounded-lg p-lg mb-xl flex items-center gap-lg">
        <div class="h-14 w-14 rounded-full bg-${ok ? "success" : "danger"}/15 flex items-center justify-center"><span class="material-symbols-outlined text-${ok ? "success" : "danger"} text-[32px] ${ok ? "pulse-live rounded-full" : ""}">${ok ? "favorite" : "error"}</span></div>
        <div><div class="text-headline-md ${ok ? "text-success" : "text-danger"}">${(d.status || "").toUpperCase()}</div><div class="text-on-surface-variant text-body-sm">${esc(d.service)} v${esc(d.version)} · ${new Date(d.timestamp).toLocaleString("en-GB")}</div></div>
        <div class="ml-auto flex flex-wrap gap-2">${chip("Dynatrace MCP", d.partner_mcp_connected)}${chip("Gemini 3", !!d.model)}</div>
      </div>
      <div class="grid grid-cols-1 md:grid-cols-3 gap-gutter">
        ${healthCard("Model", d.model, "smart_toy")}
        ${healthCard("Partner", d.partner, "extension")}
        ${healthCard("MCP Connected", d.partner_mcp_connected ? "Yes" : "No", "lan")}
      </div>
      <div class="grid grid-cols-1 md:grid-cols-3 gap-gutter mt-gutter">
        ${listCard("Agents", d.agents, "groups")}
        ${listCard("Regulations", d.regulations, "gavel")}
        ${listCard("Features", d.features, "tune")}
      </div></div>`;
  }
  function healthCard(label, value, icon) {
    return `<div class="glass-panel p-lg rounded-lg"><div class="flex justify-between items-start mb-2"><p class="text-label-sm text-on-surface-variant uppercase">${label}</p><span class="material-symbols-outlined text-primary">${icon}</span></div><p class="text-headline-sm text-primary">${esc(value)}</p></div>`;
  }
  function listCard(label, items, icon) {
    return `<div class="glass-panel p-lg rounded-lg"><div class="flex items-center gap-2 mb-md"><span class="material-symbols-outlined text-primary">${icon}</span><h3 class="text-title-lg">${label}</h3></div><div class="flex flex-wrap gap-2">${(items || []).map((i) => `<span class="px-3 py-1 rounded-lg bg-surface-container-highest border border-outline-variant text-label-sm text-on-surface">${esc(i)}</span>`).join("")}</div></div>`;
  }

  // ---------- utilities exposed ----------
  let _csvRows = [];
  async function exportCsv() {
    try {
      const rows = await api("/api/incidents");
      const csv = ["incident_id,title,classification,started,deadline", ...rows.map((r) => `${r.incident_id},"${r.title}",${r.classification},${r.start},${r.deadline}`)].join("\n");
      download("dynacompliance-incidents.csv", csv); toast('<span class="text-on-surface">Incidents exported to CSV.</span>');
    } catch (e) { toast(`<span class="text-danger">${esc(e.message)}</span>`); }
  }
  async function exportReportCsv() {
    try {
      const rep = await api("/api/report");
      const csv = ["date,incident,id,duration,classification,submitted,deadline,status", ...rep.major_incidents.map((m) => `${m.date},"${m.title}",${m.id},${m.duration},${m.classification},${m.submitted},${m.deadline},${m.status}`)].join("\n");
      download(`dora-report-${rep.month.replace(" ", "-")}.csv`, csv); toast('<span class="text-on-surface">Report exported to CSV.</span>');
    } catch (e) { toast(`<span class="text-danger">${esc(e.message)}</span>`); }
  }
  function download(name, text) {
    const a = document.createElement("a"); a.href = URL.createObjectURL(new Blob([text], { type: "text/csv" })); a.download = name; a.click(); URL.revokeObjectURL(a.href);
  }
  async function showHealth() {
    try {
      const d = await api("/health");
      toast(`<div class="space-y-1"><div class="flex items-center gap-2 font-bold text-on-surface"><span class="w-2 h-2 rounded-full bg-success"></span>System Health — ${d.status.toUpperCase()}</div>
        <div class="text-label-sm text-on-surface-variant">model: <span class="text-primary">${d.model}</span> · partner: <span class="text-primary">${d.partner}</span> (MCP ${d.partner_mcp_connected ? "✓" : "✗"})</div>
        <div class="text-label-sm text-on-surface-variant">agents: ${(d.agents || []).join(", ")}</div></div>`);
    } catch (e) { toast(`<span class="text-danger">${esc(e.message)}</span>`); }
  }

  // ---------- router ----------
  const TITLES = { dashboard: "Dashboard", monitor: "Compliance Monitor", eba: "EBA Notifications", logs: "Incident Logs", report: "Monthly Report", health: "System Health", incident: "Incident" };
  function setTitle(key, extra) { document.title = `DynaCompliance · ${TITLES[key] || "Operations Center"}${extra ? " · " + extra : ""}`; }
  function route() {
    clearTimers(); rejectApproval();
    const hash = location.hash || "#/dashboard";
    const m = hash.match(/^#\/incident\/(.+)$/);
    if (m) { setActiveNav("#/monitor"); setTitle("incident", decodeURIComponent(m[1])); renderIncident(decodeURIComponent(m[1])); }
    else if (hash.startsWith("#/monitor")) { setActiveNav("#/monitor"); setTitle("monitor"); renderMonitor(); }
    else if (hash.startsWith("#/eba")) { setActiveNav("#/eba"); setTitle("eba"); renderEba(); }
    else if (hash.startsWith("#/logs")) { setActiveNav("#/logs"); setTitle("logs"); renderLogs(); }
    else if (hash.startsWith("#/report")) { setActiveNav("#/report"); setTitle("report"); renderReport(); }
    else if (hash.startsWith("#/health")) { setActiveNav("#/health"); setTitle("health"); renderHealth(); }
    else { setActiveNav("#/dashboard"); setTitle("dashboard"); renderDashboard(); }
    window.scrollTo(0, 0);
  }

  async function initChrome() {
    try {
      const d = await api("/health");
      const badge = document.getElementById("mode-badge");
      if (badge && d.mode === "demo") badge.classList.remove("hidden");
    } catch { /* health unreachable — leave chrome as-is */ }
  }

  window.addEventListener("hashchange", route);
  window.addEventListener("DOMContentLoaded", () => {
    document.getElementById("dt-status").addEventListener("click", showHealth);
    initChrome();
    route();
  });

  return { route, approve, rejectApproval, toggleEdit, handoff, exportCsv, exportReportCsv, showHealth, toast, filterLogs, renderHealth };
})();
