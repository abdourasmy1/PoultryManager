import test from "node:test";
import assert from "node:assert/strict";
import nacl from "tweetnacl";
import {
  canonical,
  verifyLicense,
  onlineDecision,
  offlineDecision,
  GRACE_MS,
  LicenseRecord,
  LicenseState,
} from "../lib/license-core";
const pair = nacl.sign.keyPair.fromSeed(new Uint8Array(32).fill(7));
const key = Buffer.from(pair.publicKey).toString("base64");
const start = Date.UTC(2026, 9, 27);
const record: LicenseRecord = {
  license_id: "TEST-1",
  device_id: "TEST-DEVICE",
  license_type: "trial",
  status: "active",
  start_date: "2026-10-27T00:00:00Z",
  end_date: "2026-11-27T00:00:00Z",
};
function signed(records = [record]) {
  const payload = {
    version: 1,
    issued_at: "2026-10-27T00:00:00Z",
    licenses: records,
  };
  return {
    ...payload,
    signature: Buffer.from(
      nacl.sign.detached(
        new TextEncoder().encode(canonical(payload)),
        pair.secretKey,
      ),
    ).toString("base64"),
  };
}
test("LT1–LT5 correct device, validity boundaries, revocation", () => {
  const f = verifyLicense(signed(), [key]);
  assert.equal(onlineDecision(f, "TEST-DEVICE", start).granted, true);
  assert.equal(onlineDecision(f, "OTHER", start).granted, false);
  assert.equal(
    onlineDecision(f, "TEST-DEVICE", Date.parse(record.end_date)).code,
    "EXPIRED",
  );
  assert.equal(onlineDecision(f, "TEST-DEVICE", start - 1).code, "CLOCK_ERROR");
  const revoked = verifyLicense(signed([{ ...record, status: "revoked" }]), [
    key,
  ]);
  assert.equal(onlineDecision(revoked, "TEST-DEVICE", start).code, "REVOKED");
});
test("LT6/LT8 signature, payload changes, key ordering, schema, duplicates", () => {
  assert.equal(
    canonical({ b: 2, a: { z: 1, a: 3 } }),
    '{"a":{"a":3,"z":1},"b":2}',
  );
  assert.throws(() => verifyLicense({ ...signed(), version: 2 }, [key]));
  assert.throws(() => verifyLicense({ ...signed(), signature: "" }, [key]));
  assert.throws(
    () =>
      verifyLicense(
        { ...signed(), licenses: [{ ...record, status: "revoked" }] },
        [key],
      ),
    /SIGNATURE/,
  );
  assert.throws(() => verifyLicense(signed([record, record]), [key]));
  assert.equal(
    verifyLicense(JSON.parse(JSON.stringify(signed(), null, 5)), [key]).licenses
      .length,
    1,
  );
});
test("LT9/LT10 grace limit, trusted rejection, clock rollback, stale signed file", () => {
  const state: LicenseState = {
    record,
    lastVerified: start,
    lastSeen: start,
    maxIssued: start,
    rejected: false,
  };
  assert.equal(offlineDecision(state, start + GRACE_MS - 1).granted, true);
  assert.equal(offlineDecision(state, start + GRACE_MS).granted, false);
  assert.equal(
    offlineDecision({ ...state, rejected: true }, start + 1000).granted,
    false,
  );
  assert.equal(offlineDecision(state, start - 60001).code, "CLOCK_ERROR");
  assert.equal(
    onlineDecision(
      verifyLicense(signed(), [key]),
      "TEST-DEVICE",
      start + 10000,
      { ...state, maxIssued: start + 1000 },
    ).code,
    "STALE_FILE",
  );
});
