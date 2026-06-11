# DynaCompliance — Devpost Submission (paste-ready)

**Tagline:** Live agent that classifies & files EU DORA major-incident reports from Dynatrace
in ~90 seconds — Gemini 3 + Google Cloud Agent Builder + Dynatrace MCP, human-approved.

**Live demo:** https://dynacompliance-908307939543.europe-west1.run.app
**Repo:** https://github.com/manojmallick/dynacompliance-starter
**Track:** Dynatrace

---

## Inspiration
Under the EU's Digital Operational Resilience Act (DORA), in force for EU financial entities,
a bank that suffers a *major* ICT incident has just **4 hours** to file an early-warning report
to its regulator. Today a compliance officer does this by hand — reading monitoring dashboards,
applying legal thresholds, and drafting the notice — while the regulatory clock is already
running. It takes ~47 minutes and is error-prone. We wanted an agent that does it in ~90
seconds **without** taking the human out of the loop.

## What it does
Dynatrace detects an ICT incident, and DynaCompliance:
1. **Collects** the incident data, affected services, and Davis AI root cause from Dynatrace.
2. **Classifies** it against **DORA Article 18** major-incident thresholds (>10% clients for
   >2h, >€5M transaction value, data breach, core banking down >2h, payments down >30min) —
   deterministically, so the verdict is auditable.
3. **Explains & drafts** with Gemini 3: a plain-language rationale and an EBA-template
   **Article 19** early-warning notification.
4. **Schedules** the Art.19 deadlines (4h / 72h / 1 month) anchored on the *detection* time.
5. **Proposes** writing the classification back to Dynatrace and submitting to the regulator —
   and **waits for a human to approve**, writing a signed audit record of who approved what.

## How we built it
- **Gemini 3** (`gemini-3-flash-preview`) for the classification rationale and EBA drafting.
- **Google Cloud Agent Builder / ADK** (`@google/adk`): an `LlmAgent` + `Runner` drive the
  agent loop at `POST /api/classify-agent` — this is the judged path where all three required
  technologies run in **one genuine agent invocation**.
- **Dynatrace MCP** (`@dynatrace-oss/dynatrace-mcp-server`) exposed to the agent as an
  `MCPToolset` over stdio — 20 live tools (`list_problems`, `execute_dql`,
  `chat_with_davis_copilot`, …). The response returns `mcp_tools_called` as proof the partner
  MCP server actually executed.
- A **deterministic DORA classifier** (`criteria.js`) keeps the legal thresholds in code (the
  LLM never invents them), with a `node --test` suite.
- A **human-in-the-loop control plane**: `/api/execute` rejects any write without an identified
  approver and writes a signed, append-only audit ledger.
- **Hosting:** Cloud Run on Node 24; one `src/app.js` also runs as a Vercel function. A Google
  Stitch–designed SPA renders the Operations Center, Incident Deep Dive, and Monthly Report.
- **No competing AI/cloud services** — Google + Dynatrace only.

## Challenges we ran into
- **Genuine vs. named integration.** The hardest (and most important) requirement was making
  Gemini, Agent Builder, *and* the Dynatrace MCP server all execute at runtime — not just
  appear in a config file. We built a real ADK agent that calls the live MCP server and
  surfaces `mcp_tools_called` to prove it.
- **The Dynatrace MCP reality.** Our first config referenced a package that doesn't exist; the
  real server is `@dynatrace-oss/dynatrace-mcp-server`, with its own tool names and a **Platform
  token** auth model (`dt0s16…` against `…apps.dynatrace.com`) distinct from classic API tokens.
- **Node version.** The MCP server bundles an `undici` that calls
  `webidl.util.markAsUncloneable` (Node 22+). Our `node:20` container crashed on startup until
  we moved to **Node 24**.
- **Cloud Run's read-only filesystem.** The MCP subprocess had to be spawned with `HOME=/tmp`
  and telemetry disabled, or it crashed writing to a read-only `$HOME`.

## Accomplishments we're proud of
- A live, deployed agent where **all three required technologies are provable at runtime** —
  verify at `/health` (`gemini_live`, `partner_mcp_connected` with 20 tools, `agent_builder`).
- A genuinely **defensible** classification: deterministic thresholds + an LLM that only
  explains, plus a signed audit trail a regulator would recognize.
- Real human-in-the-loop accountability, not a rubber-stamp.

## What we learned
- DORA's reporting mechanics are subtle (e.g., the 4-hour clock's precise anchor is
  *classification as major*, ≤24h from awareness — we ship a conservative detection-time
  model and say so honestly).
- "Agentic" only counts when the tools actually fire — measuring tool calls beats trusting prose.
- MCP is powerful but operationally sharp: package identity, auth model, Node version, and
  container filesystem all matter before an agent can use it in production.

## What's next
- Map real Dynatrace business metrics (clients affected, € exposure) via DQL so live verdicts
  are as rich as the demo.
- Wire a real EBA/DNB submission channel behind the approval gate.
- Tighten the DORA clock to the formal "classification-as-major" anchor.

## Built With
`google-gemini` · `google-cloud-agent-builder` · `google-adk` · `dynatrace` ·
`model-context-protocol` · `cloud-run` · `node.js` · `express` · `javascript` · `dora`
