# DynaCompliance — Demo Video Plan (≤3:00)

A shot-by-shot storyboard you can record tonight. Target **2:45–2:55** (stay under 3:00).
Format: **1080p, 16:9, screen recording + voiceover.** Live URL:
`https://dynacompliance-908307939543.europe-west1.run.app`

---

## 0. Pre-flight checklist (5 min before recording)
- [ ] **Warm the URL** — open `…/health` once so Cloud Run isn't cold (first hit can take ~10s).
- [ ] Browser at **1440×900**, zoom **100%**, hide bookmarks bar, use a clean profile (no extensions/notifications).
- [ ] Open these tabs in order: `…/#/dashboard` · `…/#/incident/INC-2026-047` · `…/#/report` · `…/health`.
- [ ] Pre-run one `POST /api/classify-agent` and **save the JSON** (it's slow live) so you can show `mcp_tools_called` without waiting on camera.
- [ ] macOS: System Settings → turn on Do Not Disturb. Quiet room / decent mic.
- [ ] Record at the screen's native res; you'll crop/zoom in edit.

## 1. Storyboard (time · screen/action · say this)

| Time | Screen / action | Narration (verbatim) | On-screen overlay |
|---|---|---|---|
| **0:00–0:18** | Title card → cut to **dashboard** | "When a bank has a major IT incident, EU law — the Digital Operational Resilience Act — gives it **four hours** to file with its regulator. Done by hand it takes about 47 minutes, and the clock is already running." | Title: *DynaCompliance* · "DORA Art.18/19 · ~90s vs ~47min" |
| **0:18–0:35** | Dashboard, slow pan; point at the MAJOR row + countdown | "DynaCompliance watches Dynatrace. Three open incidents, already triaged. One is **major** — and the four-hour early-warning countdown started at **detection**, not now." | Arrow → countdown `06:53 CET` |
| **0:35–1:05** | Click **INC-2026-047** → Deep Dive; let the verdict + thresholds land | "Click in. A **deterministic classifier** applies the DORA Article 18 thresholds — €8.3 million exceeds the €5 million line, payments were down over 30 minutes — so it's **MAJOR**, and it flags **Article 28** because the root cause is a third party." | Highlight the two triggered thresholds |
| **1:05–1:30** | Scroll to DynaWatcher data + **Gemini rationale** | "Dynatrace gives us the affected services and Davis AI's root cause at 97% precision. **Gemini 3** writes the rationale and drafts the Article 19 early-warning notice — it explains, it never invents the thresholds." | Label: *Gemini 3 · gemini-3-flash-preview* |
| **1:30–2:00** | Show timeline countdown → **ApprovalBar**; click **Approve & Submit** | "The regulatory clock counts down 4 hours, 72 hours, one month. And the agent never files on its own — it **proposes**, a human **approves**. Approve, and it writes the classification back to Dynatrace and submits the notice." | Label: *Human-in-the-loop · signed audit* |
| **2:00–2:20** | Cut to `…/health` (pretty-printed) | "This isn't three logos in a README. On the live URL: **Gemini is live**, the **Dynatrace MCP server is connected with 20 tools**, and the agent runs on **Google Cloud Agent Builder**." | Box-highlight `gemini_live`, `partner_mcp_connected:20`, `agent_builder` |
| **2:20–2:35** | Cut to saved **/api/classify-agent** JSON | "The judged agent runs all three in one loop, and returns the **actual Dynatrace tool calls** it made — proof, not a claim." | Highlight `mcp_tools_called` |
| **2:35–2:55** | Cut to **Monthly Report** | "And it produces the auditable DORA report and signed trail regulators ask for. Gemini for reasoning, Dynatrace for the eyes, Agent Builder for the spine — a 47-minute scramble in 90 seconds. That's **DynaCompliance**." | End card: live URL + repo URL |

## 2. The "proof" beat — why it matters
Judges' #1 disqualifier is "required tech not actually used." Spend ~30s (2:00–2:35) on
`/health` + the `mcp_tools_called` JSON. It's the single most valuable 30 seconds in the video.
Pretty-print `/health` in the browser or a terminal:
```bash
curl -s https://dynacompliance-908307939543.europe-west1.run.app/health | python3 -m json.tool
```

## 3. Recording & editing
- **Tool:** QuickTime (File → New Screen Recording) or Loom/OBS. Record video and voiceover
  separately if easier, then sync.
- **Cursor:** enable "show mouse clicks." Move deliberately; pause 1s on each key element.
- **Zoom:** in edit, punch-in (1.2–1.5×) on the verdict, the countdown, and the `/health` fields.
- **Captions:** burn in short labels (above table). Auto-generate subtitles on YouTube too.
- **Music (optional):** low, neutral bed at ~15% volume; none is fine.
- **Length guard:** if you run long, cut the 0:18–0:35 pan first.

## 4. Upload (YouTube)
- Visibility: **Unlisted is fine but the hackathon wants Public** — set **Public** (or Unlisted if
  the rules accept it; Public is safest).
- **Title:** `DynaCompliance — DORA incident reporting agent (Gemini 3 + Agent Builder + Dynatrace MCP)`
- **Description:**
  ```
  DynaCompliance classifies and files EU DORA Art.18/19 major-incident reports from Dynatrace
  in ~90 seconds — with a human approval gate. Built for the Google Cloud Rapid Agent Hackathon
  (Dynatrace track).

  Stack (all live at runtime): Gemini 3 (gemini-3-flash-preview) · Google Cloud Agent Builder /
  ADK (@google/adk) · Dynatrace MCP (@dynatrace-oss/dynatrace-mcp-server) · Cloud Run.

  Live demo: https://dynacompliance-908307939543.europe-west1.run.app
  Code: https://github.com/manojmallick/dynacompliance-starter
  ```
- **Tags:** dora, dynatrace, gemini, agent builder, adk, mcp, google cloud, compliance, regtech.

## 5. Pitfalls to avoid
- Don't open with a slow cold-start page — warm it first.
- Don't read the whole EBA draft on camera; show it, move on.
- Don't claim "live Dynatrace data" for the dashboard — it's **badged demo data**; the MCP
  connection, Gemini, and the agent are what's genuinely live. Say it that way; honesty scores.
- Keep it under 3:00 — judges stop watching at the cap.
