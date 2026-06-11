# DynaCompliance — Pitch Deck (≤3-min)

10 slides. Speaker notes are the words to say; bullets are what's on screen. Aim ~15–20s/slide.

---

## 1 — Title
**DynaCompliance**
*From Dynatrace alert to DORA-filed in 90 seconds — human-approved.*
Google Cloud Rapid Agent Hackathon · Dynatrace track
> Live: dynacompliance-908307939543.europe-west1.run.app

**Say:** "When a bank has a major IT incident, EU law gives it four hours to file with its regulator. We made an agent that does it in ninety seconds — and still keeps a human in control."

---

## 2 — The problem (stakes)
- EU **DORA** is in force for financial entities.
- A *major* ICT incident → **4-hour** early-warning filing to the regulator.
- Today: manual, ~**47 minutes**, error-prone, clock already running.

**Say:** "The clock starts at detection. A compliance officer is reading dashboards and drafting legal notices under extreme time pressure. That's the pain."

---

## 3 — The idea
An agent that **detects → classifies → drafts → schedules → proposes**, and files only
**with human approval**.
> Built on the required stack: **Gemini 3 · Google Cloud Agent Builder (ADK) · Dynatrace MCP.**

**Say:** "DynaCompliance watches Dynatrace, applies the DORA rules, drafts the regulator notice — then stops and asks a human to approve."

---

## 4 — Live demo: Operations Center
*(screenshot: `dashboard.png`)*
- Live Dynatrace feed · 3 incidents · 1 MAJOR
- Art.19 **countdown** started at detection

**Say:** "Here's the command center. One major incident, and the four-hour regulatory countdown is already ticking."

---

## 5 — Live demo: the verdict
*(screenshot: `deep-dive.png`)*
- **MAJOR** — €8.3M > €5M, payments down >30min, Art.28 third-party
- Davis AI root cause · **Gemini 3** rationale · editable EBA draft

**Say:** "The deterministic classifier returns MAJOR and explains exactly which DORA thresholds tripped. Gemini 3 writes the rationale and the Article 19 notice. The clock anchors on detection."

---

## 6 — The human gate
*(screenshot: deep-dive approval bar)*
- Agent **proposes**; never files alone
- `/api/execute` → **403 without approval**, **400 without an approver**
- **Signed, append-only audit** record

**Say:** "Nothing leaves the building without a named human approving it — and every approval is signed into an audit trail a regulator would recognize."

---

## 7 — It's a real agent (the proof)
- `POST /api/classify-agent` = **ADK + Gemini 3 + Dynatrace MCP** in *one* loop
- Returns `mcp_tools_called` → proof the MCP server actually ran
- `/health`: `gemini_live` · `partner_mcp_connected` (20 tools) · `agent_builder`

**Say:** "This isn't three logos in a README. The agent really calls the Dynatrace MCP server's tools at runtime, and we return the tool calls as receipts."

---

## 8 — Architecture
*(diagram: ARCHITECTURE.md system overview)*
- Deterministic classifier (auditable) + LLM explainer (no hallucinated thresholds)
- One `src/app.js` → Cloud Run **and** Vercel · Node 24

**Say:** "The legal thresholds live in code, so the verdict is reproducible. Gemini only explains and drafts. One service, deployed on Cloud Run."

---

## 9 — Impact & honesty
- ~**90s vs ~47min**; defensible, auditable, human-approved
- Honest boundaries: detection-time clock is a conservative simplification of DORA's
  "classification-as-major" anchor; live metric mapping is next

**Say:** "Real regulatory pain, real time saved — and we're upfront about what's simplified."

---

## 10 — Close
**DynaCompliance** — Gemini 3 reasoning, Dynatrace as the eyes, Agent Builder as the spine.
A 47-minute compliance scramble → a 90-second, auditable, human-approved filing.
> Try it live · github.com/manojmallick/dynacompliance-starter

**Say:** "Gemini for the reasoning, Dynatrace for the eyes, Agent Builder for the spine. That's DynaCompliance — thank you."
