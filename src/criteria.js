// DORA Article 18 major-incident classification criteria + Article 19 reporting-deadline math.
// (Art.17 = incident-management process; Art.18 = classification; Art.19 = reporting.)
// Deterministic so the classification is auditable; Gemini 3 explains + drafts on top.

// MAJOR if ANY threshold is met (regulatory principle: when in doubt, report MAJOR).
export const THRESHOLDS = {
  clients_pct: 10,            // > 10% of clients affected
  clients_duration_min: 120, // ... for > 2 hours
  transaction_value_eur: 5_000_000, // > €5M affected
  core_banking_down_min: 120,       // core banking unavailable > 2h
  payments_down_min: 30,            // payment processing down > 30 min
};

/**
 * @param {object} m incident metrics:
 *   { clients_affected_pct, duration_min, transaction_value_eur, data_breach,
 *     core_banking_down_min, payments_down_min, root_cause_third_party }
 * @returns {{classification:'MAJOR'|'MINOR', triggered:string[], also:string[]}}
 */
export function classify(m) {
  const triggered = [];
  if (m.clients_affected_pct > THRESHOLDS.clients_pct && (m.duration_min ?? 0) > THRESHOLDS.clients_duration_min)
    triggered.push(`Clients ${m.clients_affected_pct}% > 10% for >2h`);
  if ((m.transaction_value_eur ?? 0) > THRESHOLDS.transaction_value_eur)
    triggered.push(`Transaction value €${(m.transaction_value_eur / 1e6).toFixed(1)}M > €5M`);
  if (m.data_breach) triggered.push("Customer data breach");
  if ((m.core_banking_down_min ?? 0) > THRESHOLDS.core_banking_down_min)
    triggered.push("Core banking unavailable >2h");
  if ((m.payments_down_min ?? 0) > THRESHOLDS.payments_down_min)
    triggered.push("Payment processing down >30min");

  const also = [];
  if (m.root_cause_third_party) also.push("DORA Article 28 (ICT third-party risk)");

  return { classification: triggered.length ? "MAJOR" : "MINOR", triggered, also };
}

/**
 * DORA Article 19 reporting deadlines. The clock anchors on DETECTION (when the
 * entity became aware), not incident start — Davis AI's detection timestamp is the
 * regulatory anchor. Pass `detected_at`; falls back to incident start if absent.
 */
export function deadlines(anchorIso) {
  const anchor = new Date(anchorIso);
  const add = (mins) => new Date(anchor.getTime() + mins * 60_000).toISOString();
  return {
    early_warning: add(4 * 60),       // 4 hours  (initial notification)
    intermediate: add(72 * 60),       // 72 hours (intermediate report)
    final: add(30 * 24 * 60),         // ~1 month (final report)
  };
}
