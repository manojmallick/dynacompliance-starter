// Smoke tests for the deterministic DORA core. Run: npm test
import { test } from "node:test";
import assert from "node:assert/strict";
import { classify, deadlines, THRESHOLDS } from "../src/criteria.js";
import { getMockIncident } from "../src/mockdata.js";

test("MAJOR: payment incident over €5M and payments down >30min", () => {
  const v = classify(getMockIncident("INC-2026-047"));
  assert.equal(v.classification, "MAJOR");
  assert.ok(v.triggered.some((t) => t.includes("€8.3M")), "value threshold triggered");
  assert.ok(v.triggered.some((t) => t.includes("Payment")), "payments threshold triggered");
});

test("Art.28 flagged when root cause is a third party", () => {
  const v = classify(getMockIncident("INC-2026-047"));
  assert.ok(v.also.some((a) => a.includes("Article 28")), "third-party obligation flagged");
});

test("MINOR: sub-threshold incidents do not trigger", () => {
  for (const id of ["INC-2026-048", "INC-2026-049"]) {
    const v = classify(getMockIncident(id));
    assert.equal(v.classification, "MINOR", `${id} should be MINOR`);
    assert.equal(v.triggered.length, 0);
  }
});

test("borderline rule: any single threshold => MAJOR", () => {
  const v = classify({ transaction_value_eur: THRESHOLDS.transaction_value_eur + 1 });
  assert.equal(v.classification, "MAJOR");
});

test("Art.19 clock anchors on the passed timestamp (+4h / +72h / ~1mo)", () => {
  const anchor = "2026-06-08T10:00:00.000Z";
  const dl = deadlines(anchor);
  assert.equal(dl.early_warning, "2026-06-08T14:00:00.000Z");        // +4h
  assert.equal(dl.intermediate, "2026-06-11T10:00:00.000Z");         // +72h
  assert.equal(new Date(dl.final) - new Date(anchor), 30 * 24 * 60 * 60 * 1000); // ~1 month
});
