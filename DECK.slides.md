---
marp: true
paginate: true
backgroundColor: #0a0e14
color: #e6edf3
style: |
  section {
    font-family: -apple-system, "Segoe UI", Roboto, sans-serif;
    font-size: 26px;
    padding: 60px 70px;
  }
  h1 { color: #22d3ee; font-size: 52px; }
  h2 { color: #22d3ee; font-size: 38px; border-bottom: 2px solid #1e2a36; padding-bottom: 10px; }
  strong { color: #67e8f9; }
  a { color: #38bdf8; }
  code { background: #11202b; color: #7dd3fc; padding: 2px 6px; border-radius: 4px; }
  table { font-size: 22px; }
  blockquote { border-left: 4px solid #22d3ee; color: #9fb3c8; font-size: 22px; }
  .big { font-size: 40px; line-height: 1.3; }
  section.lead { text-align: center; }
  section.lead h1 { font-size: 64px; }
---

<!-- _class: lead -->

# DynaCompliance

## From a Dynatrace alert to a DORA‑filed report in **90 seconds** — human‑approved.

Google Cloud Rapid Agent Hackathon · **Dynatrace** track

> 🟢 Live: dynacompliance-908307939543.europe-west1.run.app

---

## The problem

<div class="big">

EU **DORA** is in force for financial entities.

A **major** ICT incident → **4‑hour** early‑warning filing to the regulator.

Today: manual, **~47 minutes**, error‑prone — and the clock starts at **detection**.

</div>

---

## The idea

An agent that **detects → classifies → drafts → schedules → proposes**,
and files **only with human approval**.

Built on the required stack — all three live at runtime:

- 🧠 **Gemini 3** (`gemini-3-flash-preview`) — rationale + EBA drafting
- 🏗️ **Google Cloud Agent Builder / ADK** (`@google/adk`) — the agent loop
- 📊 **Dynatrace MCP** (`@dynatrace-oss/dynatrace-mcp-server`) — 20 live tools

---

![bg right:58%](docs/screenshots/dashboard.png)

## Operations Center

- Live Dynatrace feed — **3 incidents, 1 MAJOR**
- Article 19 **countdown** started at **detection**
- Each incident pre‑triaged by the agent

---

![bg right:55%](docs/screenshots/deep-dive.png)

## The verdict

- **MAJOR** — €8.3M > €5M, payments down > 30 min
- **Article 28** flagged — third‑party root cause
- Davis AI root cause · **Gemini 3** rationale
- Deterministic thresholds → defensible, reproducible

---

![bg right:55%](docs/screenshots/deep-dive.png)

## The human gate

- The agent **proposes**; it never files alone
- `/api/execute` → **403** without approval, **400** without an approver
- Every approval → **signed, append‑only audit** record

> Responsible AI you can show a regulator.

---

## It's a real agent — the proof

`POST /api/classify-agent` = **ADK + Gemini 3 + Dynatrace MCP** in *one* loop.

- Returns `mcp_tools_called` → receipts that the MCP server actually ran
- `/health`: `gemini_live` · `partner_mcp_connected` **(20 tools)** · `agent_builder`

> Not three logos in a README — three technologies firing at runtime.

---

![bg 90%](docs/screenshots/architecture.png)

---

## Impact & honesty

- ~**90s vs ~47min** — defensible, auditable, human‑approved
- **No competing AI/cloud** — Google + Dynatrace only
- Honest boundaries: detection‑time clock is a conservative simplification of DORA's
  "classification‑as‑major" anchor; live metric mapping is next

---

<!-- _class: lead -->

# DynaCompliance

Gemini 3 for reasoning · Dynatrace for the eyes · Agent Builder for the spine.

A **47‑minute** scramble → a **90‑second**, auditable, human‑approved filing.

> ▶ dynacompliance-908307939543.europe-west1.run.app
> ⌨ github.com/manojmallick/dynacompliance-starter
