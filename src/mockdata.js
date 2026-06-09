// Shared demo dataset so the entire app (dashboard, deep-dive, report) runs
// credential-free with MOCK=true. Timestamps are relative to "now" so the DORA
// reporting countdowns are live during a demo.

import { classify, deadlines } from "./criteria.js";

const minAgo = (m) => new Date(Date.now() - m * 60_000).toISOString();

// Full incident-metric objects (the shape criteria.js → classify() consumes),
// plus a few display-only fields used by the deep-dive view.
export const MOCK_INCIDENTS = [
  {
    incident_id: "INC-2026-047",
    title: "Payment Service Unavailability",
    subtitle: "Core API Gateway timeout — Acquiring & Settlement",
    start: minAgo(47),
    detected_at: minAgo(41), // Davis AI detected ~6 min after onset — the DORA clock anchor
    duration_min: 47,
    affected_systems: ["PaymentProcessing", "CardAuth"],
    clients_affected_pct: 15.2,
    transaction_value_eur: 8_300_000,
    payments_down_min: 47,
    core_banking_down_min: 0,
    data_breach: false,
    root_cause_third_party: true,
    davis_root_cause: "AWS RDS connection pool exhaustion",
    transaction_failures: 12_847,
    davis_precision: 97,
  },
  {
    incident_id: "INC-2026-048",
    title: "DB Query Latency Spike",
    subtitle: "Region EU-West-1 — slow index scan",
    start: minAgo(33),
    detected_at: minAgo(31),
    duration_min: 33,
    affected_systems: ["OrdersDB"],
    clients_affected_pct: 4.1,
    transaction_value_eur: 120_000,
    payments_down_min: 0,
    core_banking_down_min: 0,
    data_breach: false,
    root_cause_third_party: false,
    davis_root_cause: "Slow index scan on orders table",
    transaction_failures: 318,
    davis_precision: 88,
  },
  {
    incident_id: "INC-2026-049",
    title: "Auth Service Retry Error",
    subtitle: "Mobile Login Module — token refresh retries",
    start: minAgo(9),
    detected_at: minAgo(8),
    duration_min: 9,
    affected_systems: ["AuthService"],
    clients_affected_pct: 1.2,
    transaction_value_eur: 0,
    payments_down_min: 0,
    core_banking_down_min: 0,
    data_breach: false,
    root_cause_third_party: false,
    davis_root_cause: "Token refresh race condition",
    transaction_failures: 42,
    davis_precision: 76,
  },
];

export const getMockIncident = (id) =>
  MOCK_INCIDENTS.find((i) => i.incident_id === id) || MOCK_INCIDENTS[0];

/** Dynatrace-problem-shaped summaries for /api/problems passthrough. */
export const mockProblems = () => ({
  totalCount: MOCK_INCIDENTS.length,
  problems: MOCK_INCIDENTS.map((i) => ({
    problemId: i.incident_id,
    title: i.title,
    status: "OPEN",
    startTime: new Date(i.start).getTime(),
    affectedEntities: i.affected_systems.map((name) => ({ name })),
    rootCauseEntity: { name: i.davis_root_cause },
  })),
});

/** Enriched feed rows the dashboard table renders directly. */
export function mockIncidentRows() {
  return MOCK_INCIDENTS.map((i) => {
    const v = classify(i);
    return {
      incident_id: i.incident_id,
      title: i.title,
      subtitle: i.subtitle,
      start: i.start,
      classification: v.classification,
      triggered: v.triggered,
      also: v.also,
      status: v.classification === "MAJOR" ? "automating" : "classified",
      deadline: deadlines(i.detected_at || i.start).early_warning,
    };
  });
}

/** Monthly DORA compliance report aggregate for the report view. */
export function mockReport() {
  return {
    month: "May 2026",
    totals: { incidents: 47, major: 3, on_time_pct: 100, avg_classification_s: 90 },
    trend: {
      labels: ["MAY 01", "MAY 07", "MAY 14", "MAY 21", "MAY 28", "MAY 31"],
      total: [12, 18, 16, 24, 28, 31],
      major: [0, 1, 1, 2, 2, 3],
    },
    major_incidents: [
      { date: "2026-05-14", title: "T3 Gateway Latency Spikes", id: "INC-99423", duration: "14m 22s", classification: "MAJOR", submitted: "14:22:01", deadline: "15:09:00", status: "ON-TIME" },
      { date: "2026-05-21", title: "DDoS Mitigation Trigger", id: "INC-99488", duration: "03m 11s", classification: "MAJOR", submitted: "09:11:45", deadline: "09:58:00", status: "ON-TIME" },
      { date: "2026-05-28", title: "Database Master Handover", id: "INC-99502", duration: "21m 45s", classification: "MAJOR", submitted: "03:45:12", deadline: "04:32:00", status: "ON-TIME" },
    ],
    article_coverage: [
      { article: "Article 18: Incident Classification", pct: 100, note: "All incidents mapped and categorized per DORA standard." },
      { article: "Article 19: Major-Incident Reporting", pct: 100, note: "All major incidents filed within regulatory deadlines." },
      { article: "Article 28: Third-Party Risk", pct: 85, note: "3 providers pending annual review updates." },
    ],
    audit_trail: [
      { title: "Compliance Export Triggered", detail: "System Agent [S-44] initiated Full May Export.", when: "Today, 08:45 AM", severity: "Standard", tone: "primary" },
      { title: "Article 18 Threshold Alert", detail: "Incident INC-99502 auto-classified as MAJOR by Risk Engine.", when: "Yesterday, 11:22 PM", severity: "High", tone: "tertiary" },
      { title: "User Audit Access", detail: "Supervisor Account [J. Miller] reviewed EBA Logs.", when: "May 29, 02:15 PM", severity: "Log", tone: "outline" },
      { title: "Firewall Config Snapshot", detail: "Automated backup of edge security rules completed.", when: "May 29, 01:00 AM", severity: "Info", tone: "outline" },
    ],
  };
}
