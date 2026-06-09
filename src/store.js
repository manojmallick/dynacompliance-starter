// Approval audit ledger — the DORA Art.19 defensibility record.
//
// Persistence strategy:
//   • DATABASE_URL set (e.g. Neon Postgres) → append-only `audit_log` table that
//     survives serverless cold starts. This is the production path on Vercel/Cloud Run.
//   • DATABASE_URL absent → in-memory fallback so the app still runs locally / in the
//     credential-free demo (resets on restart — fine for `npm run demo`).
//
// Uses @neondatabase/serverless (HTTP driver) so it works in serverless functions
// without a connection pool.

import { createHash } from "node:crypto";

const hasDb = !!process.env.DATABASE_URL;
const mem = [];
let _sql = null;

async function sql() {
  if (!hasDb) return null;
  if (_sql) return _sql;
  const { neon } = await import("@neondatabase/serverless");
  _sql = neon(process.env.DATABASE_URL);
  await _sql`CREATE TABLE IF NOT EXISTS audit_log (
    id           text PRIMARY KEY,
    at           timestamptz NOT NULL,
    approver     jsonb NOT NULL,
    incident_id  text,
    classification text,
    executed     jsonb,
    signature    text NOT NULL
  )`;
  return _sql;
}

async function nextId(db) {
  if (!db) return `AUD-${mem.length + 1}`;
  const [{ count }] = await db`SELECT count(*)::int AS count FROM audit_log`;
  return `AUD-${count + 1}`;
}

/**
 * Append a signed, immutable approval record.
 * @param {{approver:object, incident_id?:string, classification?:string, executed?:string[]}} p
 * @returns the full persisted entry incl. id + signature.
 */
export async function appendAudit({ approver, incident_id, classification, executed }) {
  const at = new Date().toISOString();
  const canonical = JSON.stringify({ approver, incident_id, classification, executed, at });
  const signature = createHash("sha256").update(canonical).digest("hex").slice(0, 16);
  const db = await sql();
  const id = await nextId(db);
  const entry = { id, at, approver, incident_id, classification, executed, signature };
  if (!db) { mem.unshift(entry); return entry; }
  await db`INSERT INTO audit_log (id, at, approver, incident_id, classification, executed, signature)
           VALUES (${id}, ${at}, ${JSON.stringify(approver)}, ${incident_id}, ${classification},
                   ${JSON.stringify(executed)}, ${signature})`;
  return entry;
}

/** Most-recent-first audit entries. */
export async function listAudit(limit = 50) {
  const db = await sql();
  if (!db) return mem.slice(0, limit);
  const rows = await db`SELECT * FROM audit_log ORDER BY at DESC LIMIT ${limit}`;
  return rows.map((r) => ({
    id: r.id,
    at: new Date(r.at).toISOString(),
    approver: r.approver,
    incident_id: r.incident_id,
    classification: r.classification,
    executed: r.executed,
    signature: r.signature,
  }));
}

/** True when a durable store is configured (surfaced in /health). */
export const auditPersistent = hasDb;
