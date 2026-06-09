// DynaCompliance agent — Gemini 3 over Dynatrace incident data + DORA Art.18 classification & Art.19 reporting.
//
// Multi-step mission (the "it's an agent, not a chatbot" requirement):
//   1. COLLECT    incident data from Dynatrace (problem details, Davis AI root cause)  [MCP]
//   2. CLASSIFY   apply DORA Art.18 thresholds deterministically                       [criteria.js]
//   3. EXPLAIN    Gemini 3 explains the decision + drafts the EBA early-warning notice
//   4. SCHEDULE   compute reporting deadlines from incident start
//   5. PROPOSE    push classification to Dynatrace + submit notification — GATED on approval
//
// Steps 1–4 are read-only and run automatically. Step 5 executes only after the
// ApprovalBar returns approval (see server.js /api/execute).

import { GoogleGenAI } from "@google/genai";
import { getProblem, toIncident, forwardToIncidentIQ } from "./dynatrace.js";
import { classify, deadlines } from "./criteria.js";
import { getMockIncident } from "./mockdata.js";

const MODEL = process.env.GEMINI_MODEL || "gemini-3";
// Gemini access is provider-flexible so the same code runs on Vercel and Cloud Run:
//   • GEMINI_API_KEY set            → Gemini Developer API (simplest on Vercel)
//   • else                          → Vertex AI via Application Default Credentials
//                                     (native on Cloud Run; needs a service account elsewhere)
const ai = process.env.GEMINI_API_KEY
  ? new GoogleGenAI({ apiKey: process.env.GEMINI_API_KEY })
  : new GoogleGenAI({ vertexai: true });

const DRAFT_SYSTEM = `You are DynaCompliance, a DORA incident-reporting officer for a
financial entity (classification under Article 18, reporting under Article 19). Given an
ICT incident and its deterministic DORA classification,
(1) explain in 2-3 sentences why it is MAJOR or MINOR, referencing the triggered Art.18
thresholds; (2) if MAJOR, draft a concise EBA-template Art.19 early-warning notification to
the national competent authority (e.g. DNB) with: entity, incident start, impact
(% clients, € value), affected services, preliminary root cause. Do not invent figures
beyond those provided. Return STRICT JSON:
{ "rationale": string, "eba_draft": string, "confidence": number }`;

/** Steps 1-4: classify an incident + draft. Read-only. */
export async function analyze(problemId) {
  if (process.env.MOCK === "true") return mockAnalyze(problemId);
  const t0 = Date.now();
  const steps = [];

  const problem = await getProblem(problemId);
  const incident = toIncident(problem);
  steps.push({ agent: "DynaWatcher", action: `collected problem ${problemId}`, ms: Date.now() - t0 });

  const verdict = classify(incident);
  steps.push({ agent: "DORAClassifier", action: `classified ${verdict.classification} (${verdict.triggered.length} criteria)`, ms: Date.now() - t0 });

  const dl = deadlines(incident.detected_at || incident.start);

  const res = await ai.models.generateContent({
    model: MODEL,
    config: { systemInstruction: DRAFT_SYSTEM, responseMimeType: "application/json" },
    contents: `INCIDENT:\n${JSON.stringify(incident, null, 2)}\n\nDETERMINISTIC CLASSIFICATION:\n${JSON.stringify(verdict, null, 2)}\n\nDEADLINES:\n${JSON.stringify(dl, null, 2)}`,
  });
  steps.push({ agent: "DORAClassifier", action: "Gemini 3 drafted rationale + EBA notice", ms: Date.now() - t0 });

  let drafted;
  try { drafted = JSON.parse(res.text); }
  catch { drafted = { rationale: res.text, eba_draft: "", confidence: 0.5 }; }

  const proposedAction = {
    type: "submit_and_writeback",
    description:
      verdict.classification === "MAJOR"
        ? `Submit DORA Art.19 early-warning to DNB + write classification to Dynatrace (deadline ${dl.early_warning})`
        : `Write MINOR classification to Dynatrace (no report required)`,
    tools: [
      "dynatrace.push_event(DORA_classification)",
      ...(verdict.classification === "MAJOR" ? ["notify.submit_eba(early_warning)"] : []),
    ],
  };

  return { incident, verdict, deadlines: dl, ...drafted, steps, elapsed_ms: Date.now() - t0, proposedAction };
}

// --- MOCK MODE: canned demo data so the full UI + ApprovalBar flow runs without creds.
//     Runs the REAL deterministic classifier over the shared demo dataset so each
//     incident classifies coherently; only the LLM prose is canned.
function mockAnalyze(problemId = "INC-2026-047") {
  const incident = getMockIncident(problemId);
  const verdict = classify(incident);
  const dl = deadlines(incident.detected_at || incident.start);
  const major = verdict.classification === "MAJOR";
  const eur = (incident.transaction_value_eur / 1e6).toFixed(1);
  const startCET = new Date(incident.start).toLocaleString("en-GB", { timeZone: "Europe/Amsterdam" });

  const rationale = major
    ? `Classified MAJOR: ${verdict.triggered.join("; ")}. ${incident.root_cause_third_party ? "Root cause is a third party, so DORA Art.28 also applies. " : ""}Davis AI grounds the root cause as “${incident.davis_root_cause}” at ${incident.davis_precision}% precision.`
    : `Classified MINOR: no DORA Art.18 major-incident threshold was breached (clients ${incident.clients_affected_pct}%, €${eur}M, payments down ${incident.payments_down_min}min). Continue monitoring; no early-warning report required.`;

  const eba_draft = major
    ? `EARLY WARNING — DORA Art.19 (classification per Art.18)\nEntity: Payments Pro BV (DYNA-BANK-NL-01)\nIncident: ${incident.incident_id} — ${incident.title}\nIncident start: ${startCET}\nClassification: MAJOR\nImpact: ${incident.clients_affected_pct}% of clients, €${eur}M transactions, ${incident.transaction_failures?.toLocaleString?.() || ""} failed transactions\nAffected services: ${incident.affected_systems.join(", ")}\nPreliminary root cause: ${incident.davis_root_cause}.\nRegulatory body: DNB (De Nederlandsche Bank)`
    : "";

  const proposedAction = {
    type: "submit_and_writeback",
    description: major
      ? `Submit DORA Art.19 early-warning to DNB + write classification to Dynatrace (deadline ${dl.early_warning})`
      : `Write MINOR classification to Dynatrace (no report required)`,
    tools: [
      "dynatrace.push_event(DORA_classification)",
      ...(major ? ["notify.submit_eba(early_warning)"] : []),
    ],
  };

  return {
    incident, verdict, deadlines: dl, rationale, eba_draft,
    confidence: major ? 0.94 : 0.82,
    steps: [
      { agent: "DynaWatcher", action: `collected problem ${problemId} (mock)`, ms: 340 },
      { agent: "DORAClassifier", action: `classified ${verdict.classification} (${verdict.triggered.length} criteria) (mock)`, ms: 360 },
      { agent: "DORAClassifier", action: "Gemini 3 drafted rationale + EBA notice (mock)", ms: 1200 },
    ],
    elapsed_ms: 1200,
    proposedAction,
  };
}

/** Step 5: executed ONLY after human approval (called by /api/execute). */
export async function executeProposed({ incident, verdict, eba_draft }) {
  if (process.env.MOCK === "true") {
    const executed = ["dynatrace.push_event", ...(verdict?.classification === "MAJOR" ? ["notify.submit_eba"] : [])];
    return { ok: true, executed, at: new Date().toISOString() };
  }
  const { pushEvent } = await import("./dynatrace.js");
  const done = [];
  await pushEvent(`type("SERVICE"),entityName("${incident.affected_systems?.[0] || ""}")`, {
    title: `DORA ${verdict.classification} — ${incident.incident_id}`,
    classification: verdict.classification,
    triggered: verdict.triggered.join("; "),
  });
  done.push("dynatrace.push_event");
  if (verdict.classification === "MAJOR") {
    // Wire a real regulator submission/email here. Stubbed as logged for the demo.
    console.log("[EBA SUBMIT]", incident.incident_id, eba_draft?.slice(0, 120));
    done.push("notify.submit_eba");
  }
  return { ok: true, executed: done, at: new Date().toISOString() };
}

/** Build the detection payload IncidentIQ's /api/ingest expects, from an analysis. */
export function buildDetection(analysis) {
  const i = analysis.incident || {};
  return {
    source: "dynacompliance",
    incident_id: i.incident_id,
    title: i.title,
    description: i.title ? `${i.title} — ${i.davis_root_cause || ""}`.trim() : i.davis_root_cause,
    start: i.start,
    detected_at: i.detected_at || i.start || new Date().toISOString(), // the DORA clock anchor
    duration_min: i.duration_min,
    affected_systems: i.affected_systems,
    clients_affected_pct: i.clients_affected_pct,
    transaction_value_eur: i.transaction_value_eur,
    payments_down_min: i.payments_down_min,
    core_banking_down_min: i.core_banking_down_min,
    data_breach: i.data_breach,
    root_cause_third_party: i.root_cause_third_party,
    davis_root_cause: i.davis_root_cause,
    dyna_classification: analysis.verdict?.classification, // DynaCompliance's real-time call
  };
}

/**
 * Detect → hand off: classify in real time here, then forward to IncidentIQ for the
 * authoritative classification decision + regulatory filing. Returns both sides.
 */
export async function handoff(problemId) {
  const analysis = await analyze(problemId);
  const detection = buildDetection(analysis);
  const forward = await forwardToIncidentIQ(detection);
  return { dynacompliance: analysis, detection, ...forward };
}
