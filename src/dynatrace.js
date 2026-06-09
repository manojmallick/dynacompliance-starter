// Dynatrace integration — the partner capability.
//
// The JUDGED agent reaches Dynatrace through the Dynatrace MCP server inside Google
// Cloud Agent Builder (see agent-builder/agent.json). This module mirrors the same
// reads/writes via the Dynatrace API v2 so the hosted web app runs end-to-end.

const ENV = process.env.DT_ENV_URL;
const TOKEN = process.env.DT_API_TOKEN;

// When DT_USE_MCP=true, reads go through the real Dynatrace MCP server (see
// dynatrace-mcp.js) — satisfying "partner MCP server called at runtime". The REST v2
// path below is the default/fallback and is used for the write-back (MCP server has no
// equivalent push_event tool).
const USE_MCP = process.env.DT_USE_MCP === "true";

async function dt(path, init = {}) {
  const res = await fetch(`${ENV}/api/v2${path}`, {
    ...init,
    headers: { Authorization: `Api-Token ${TOKEN}`, "Content-Type": "application/json", ...(init.headers || {}) },
  });
  if (!res.ok) throw new Error(`Dynatrace ${res.status} ${path}: ${await res.text()}`);
  return res.status === 204 ? null : res.json();
}

// --- READS (run automatically) ---
export const getProblem = async (problemId) => {
  if (USE_MCP) {
    const { getProblemViaMCP } = await import("./dynatrace-mcp.js");
    return getProblemViaMCP(problemId);
  }
  return dt(`/problems/${problemId}`);
};
export const listProblems = async () => {
  if (process.env.MOCK === "true") {
    const { mockProblems } = await import("./mockdata.js");
    return mockProblems();
  }
  if (USE_MCP) {
    const { listProblemsViaMCP } = await import("./dynatrace-mcp.js");
    return listProblemsViaMCP();
  }
  return dt(`/problems?problemSelector=status("open")`);
};

/** Normalize a Dynatrace problem into the incident metrics criteria.js expects.
 *  Real envs vary — map Davis AI fields / custom metrics to these keys. */
export function toIncident(problem) {
  const start = problem.startTime ? new Date(problem.startTime).toISOString() : new Date().toISOString();
  const duration_min = problem.startTime ? Math.round((Date.now() - problem.startTime) / 60000) : 0;
  return {
    incident_id: problem.problemId,
    title: problem.title,
    start,
    duration_min,
    affected_systems: (problem.affectedEntities || []).map((e) => e.name),
    // These come from your monitored metrics — placeholders to wire per environment:
    clients_affected_pct: problem.clients_affected_pct ?? 0,
    transaction_value_eur: problem.transaction_value_eur ?? 0,
    payments_down_min: problem.payments_down_min ?? 0,
    core_banking_down_min: problem.core_banking_down_min ?? 0,
    data_breach: problem.data_breach ?? false,
    root_cause_third_party: problem.root_cause_third_party ?? false,
    davis_root_cause: problem.rootCauseEntity?.name,
  };
}

// --- WRITES (consequential — gated on human approval in server.js /execute) ---
export const pushEvent = (entitySelector, properties) =>
  dt(`/events/ingest`, {
    method: "POST",
    body: JSON.stringify({
      eventType: "CUSTOM_INFO",
      title: properties.title || "DORA classification",
      entitySelector,
      properties,
    }),
  });

export async function pingDynatrace() {
  if (process.env.MOCK === "true") return true;
  try { await dt(`/problems?pageSize=1`); return true; } catch { return false; }
}

// --- CROSS-APP HANDOFF: DynaCompliance (detect) → IncidentIQ (classify + file) ---
// DynaCompliance owns real-time detection and starts the DORA clock; IncidentIQ owns
// the retrospective classification decision + the regulatory filing. We forward the
// detection so the two compose into one detect→report pipeline.
const INCIDENTIQ_URL = process.env.INCIDENTIQ_URL; // e.g. https://incidentiq-xxxx.run.app

export async function forwardToIncidentIQ(detection) {
  if (process.env.MOCK === "true" || !INCIDENTIQ_URL) {
    return { forwarded: false, reason: INCIDENTIQ_URL ? "mock" : "INCIDENTIQ_URL not set", detection };
  }
  const res = await fetch(`${INCIDENTIQ_URL}/api/ingest`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(detection),
  });
  if (!res.ok) throw new Error(`IncidentIQ ingest ${res.status}: ${await res.text()}`);
  return { forwarded: true, incidentiq: await res.json() };
}
