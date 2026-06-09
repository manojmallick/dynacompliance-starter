# DynaCompliance — 3-Minute Demo Script & Judging Map

> Google Cloud Rapid Agent Hackathon · Dynatrace bucket
> Run `npm run demo` → open **http://localhost:8090**

## The hook (15s)
> "Under the EU's Digital Operational Resilience Act, a bank that suffers a major ICT
> incident has **4 hours** to file an early-warning report to its regulator. Today a
> compliance officer does this by hand — reading dashboards, applying legal thresholds,
> drafting the notice. It takes ~47 minutes and the clock is already running.
> **DynaCompliance does it in ~90 seconds, and keeps a human in control.**"

## The walkthrough (2 min)
1. **Dashboard** (`#/dashboard`) — "Dynatrace is streaming three open incidents. The
   agent has already triaged each one. Note the live **Art.19 early-warning countdown**
   on the major incident — that clock started at *detection*, not now."
2. **Click the MAJOR incident** → Deep Dive (`#/incident/INC-2026-047`):
   - **DynaWatcher** pulled the data from Dynatrace (services, €8.3M exposure, Davis AI
     root cause at 97% precision).
   - **DORAClassifier** applied **Article 18** thresholds deterministically →
     **MAJOR** (€8.3M > €5M; payments down > 30 min), and flagged **Article 28** because
     the root cause is a third party.
   - **Gemini 3** wrote the rationale and drafted the **Article 19** early-warning notice.
   - The **regulatory timeline** counts down 4h / 72h / 1-month from detection.
3. **The approval gate** — "The agent never files on its own. It *proposes*; the human
   approves." Click **Approve & Submit** → it writes the classification back to Dynatrace
   and submits the EBA notice. That's the whole detect→report loop, closed.
4. **Monthly Report** (`#/report`) — "And it produces the audit trail regulators ask for."

## The close (15s)
> "Two agents, Gemini 3 reasoning, Dynatrace as the eyes, Google Cloud Agent Builder as
> the spine — turning a 47-minute compliance scramble into a 90-second, auditable,
> human-approved workflow. That's DynaCompliance."

---

## Why this wins — mapping to judging criteria

| Criterion | How DynaCompliance scores |
|---|---|
| **Required stack** | Gemini 3 (rationale + drafting), Google Cloud Agent Builder (`agent-builder/agent.json`), Dynatrace via **Dynatrace MCP** — all three, provable at `/health`. |
| **Agent, not a chatbot** | A 5-step autonomous mission: collect → classify → explain → schedule deadlines → propose. Deterministic classifier + LLM reasoning, not a prompt box. |
| **Partner depth (Dynatrace)** | Reads problems, affected entities, metrics, **Davis AI** root cause; writes classification back as a custom event. Detection timestamp anchors the regulatory clock. |
| **Real-world impact** | DORA is in force for EU financial entities; the 4-hour early-warning window is a genuine, high-stakes pain. Quantified: ~90s vs ~47min. |
| **Responsible AI / human-in-the-loop** | Every consequential write is **gated on an identified human approver** — `/api/execute` returns 403 without approval, 400 without an approver identity, and writes a **signed, append-only audit record** (`/api/audit`) stamped with who/when + a SHA-256 signature. Live approvals appear in the report's Audit Trail. |
| **Correctness & polish** | Classification is **auditable + deterministic** (`criteria.js`) with a passing `node --test` suite, so it's defensible to a regulator; the LLM only explains. Article references are precise (18 = classify, 19 = report, 28 = third-party). |
| **Multi-agent composition** | The deep dive can **hand off** the detection to the sibling IncidentIQ agent (`/api/handoff`) — DynaCompliance detects and starts the clock, IncidentIQ files. Two agents, one detect→report pipeline. |
| **Demo readiness** | One command (`npm run demo`), credential-free mock mode with a visible **DEMO DATA** badge, full multi-screen UI from the Google Stitch design. |

## Proof for judges
```bash
curl http://localhost:8090/health
# { "status":"ok", "mode":"demo", "model":"gemini-3", "partner":"dynatrace",
#   "partner_reachable":true, "partner_mcp":"agent-builder/agent.json (@dynatrace/mcp-server)",
#   "regulations":["DORA Art.18","DORA Art.19","DORA Art.28"],
#   "features":["davis_ai_grounding","clock_at_detection","incidentiq_handoff"] }
```

## Known boundaries (state these honestly if asked)
- Demo runs on canned data (`MOCK=true`); flip to live with `DT_ENV_URL` / `DT_API_TOKEN`
  + Vertex auth, and map your metrics in `src/dynatrace.js → toIncident()`.
- The regulator submission is stubbed (logged) — wire your real EBA/DNB channel in
  `executeProposed()`.
- `clock_at_detection` uses Davis AI's detection timestamp; the precise DORA anchor for
  the 4h initial notification is "classification as major" (≤ 24h from awareness) — the
  4h-from-detection model is a conservative simplification.
