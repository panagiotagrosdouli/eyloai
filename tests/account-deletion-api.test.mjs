import test from "node:test";
import assert from "node:assert/strict";
import handler, { deletionReceipt } from "../server/account-deletion.js";
const uid = "d0000000-0000-4000-8000-000000000001",
  id = "d0000000-0000-4000-8000-000000000010";
const env = {
  EYLO_ENVIRONMENT: "staging",
  EYLO_STAGING_SUPABASE_REF: "abcdefghijklmnopqrst",
  EYLO_STAGING_CONFIRMED_REF: "abcdefghijklmnopqrst",
  VITE_SUPABASE_URL: "https://abcdefghijklmnopqrst.supabase.co",
  VITE_SUPABASE_ANON_KEY: "public-fixture",
  SUPABASE_SECRET_KEY: "sb_secret_fixture_not_real",
  EYLO_PRIVACY_DELETION_ENABLED: "true",
  EYLO_PRIVACY_WORKER_SECRET: "worker-fixture-secret-only-".repeat(2),
  VERCEL_ENV: "preview",
};
function response() {
  return {
    statusCode: 200,
    headers: {},
    body: null,
    setHeader(k, v) {
      this.headers[k] = v;
    },
    status(code) {
      this.statusCode = code;
      return this;
    },
    json(body) {
      this.body = body;
      return this;
    },
  };
}
async function setup(run, patch = {}) {
  const previous = Object.fromEntries(
      Object.keys({ ...env, ...patch }).map((key) => [key, process.env[key]]),
    ),
    originalFetch = globalThis.fetch;
  Object.assign(process.env, env, patch);
  const state = {
    phase: "queued",
    objects: [{ bucket: "eylo-files", path: uid + "/version/fixture.txt" }],
    calls: [],
    authDeleted: false,
    reauthOk: true,
    budget: true,
    billing: false,
    storageFailure: false,
    ambiguousDelete: false,
    busy: false,
  };
  globalThis.fetch = async (resource, options = {}) => {
    const url = new URL(String(resource)),
      path = url.pathname,
      body = options.body ? JSON.parse(options.body) : null;
    state.calls.push({ path, method: options.method || "GET", body });
    assert.equal(
      url.origin,
      env.VITE_SUPABASE_URL,
      "all credentials stay at the configured staging origin",
    );
    if (path === "/auth/v1/user")
      return Response.json({
        id: uid,
        email: "owner@example.invalid",
        is_anonymous: false,
        factors: state.mfa ? [{ status: "verified" }] : [],
      });
    if (path === "/auth/v1/token") {
      assert.equal(body.email, "owner@example.invalid");
      return Response.json(
        state.reauthOk
          ? {
              user: { id: state.wrongProof ? "another-user" : uid },
              access_token: "ephemeral-proof-not-returned",
              refresh_token: "ephemeral-refresh-not-returned",
            }
          : { error: "invalid" },
        { status: state.reauthOk ? 200 : 400 },
      );
    }
    if (path === "/auth/v1/logout") {
      assert.equal(url.searchParams.get("scope"), "local");
      return new Response(null, { status: 204 });
    }
    const rpc = path.split("/").at(-1);
    if (rpc === "consume_discovery_rate_limit")
      return Response.json([{ allowed: state.budget }]);
    if (rpc === "start_account_deletion") {
      assert.equal(body.p_user_id, uid);
      if (state.billing)
        return Response.json(
          { message: "BILLING_REVIEW_REQUIRED" },
          { status: 400 },
        );
      return Response.json({ id, phase: state.phase });
    }
    if (rpc === "pending_account_deletion") return Response.json(id);
    if (rpc === "claim_account_deletion") {
      assert.equal(body.p_id, id);
      return Response.json(
        state.busy
          ? null
          : {
              id,
              user_id: state.phase === "complete" ? null : uid,
              phase: state.phase,
              objects_removed: 0,
            },
      );
    }
    if (rpc === "release_account_deletion")
      return new Response(null, { status: 204 });
    if (rpc === "account_deletion_storage_batch")
      return Response.json(state.objects);
    if (rpc === "progress_account_deletion") {
      if (body.p_phase === "auth") assert.equal(state.objects.length, 0);
      state.phase = body.p_phase;
      return new Response(null, { status: 204 });
    }
    if (rpc === "finish_account_deletion") {
      assert.equal(state.authDeleted, true);
      assert.equal(state.objects.length, 0);
      state.phase = "complete";
      return Response.json({ id, phase: "complete" });
    }
    if (path.startsWith("/storage/v1/object/")) {
      assert.equal(options.method, "DELETE");
      assert.deepEqual(body.prefixes, [uid + "/version/fixture.txt"]);
      if (state.storageFailure)
        return Response.json({ error: "unavailable" }, { status: 503 });
      state.objects = [];
      return Response.json([{ name: uid + "/version/fixture.txt" }]);
    }
    if (path === "/auth/v1/admin/users/" + uid) {
      if (options.method === "PUT")
        return Response.json(
          { id: uid },
          { status: state.authDeleted ? 404 : 200 },
        );
      assert.equal(options.method, "DELETE");
      assert.equal(
        state.objects.length,
        0,
        "never delete Auth before file bytes",
      );
      const missing = state.authDeleted;
      state.authDeleted = true;
      if (state.ambiguousDelete) {
        state.ambiguousDelete = false;
        throw new TypeError("Simulated lost successful deletion response");
      }
      return Response.json({ id: uid }, { status: missing ? 404 : 200 });
    }
    throw new Error("Unexpected fixture path " + path);
  };
  const call = async (
    body,
    headers = { authorization: "Bearer current-owner-token" },
    method = "POST",
  ) => {
    const res = response();
    await handler({ method, headers, body }, res);
    return res;
  };
  try {
    await run({ state, call });
  } finally {
    globalThis.fetch = originalFetch;
    for (const [key, value] of Object.entries(previous)) {
      if (value === undefined) delete process.env[key];
      else process.env[key] = value;
    }
  }
}
const begin = {
  action: "begin",
  password: "Fixture-only-password",
  confirmation: "DELETE MY EYLO ACCOUNT",
};
test("deletion stays disabled for production, forbidden refs, unconfirmed staging and missing worker secret before any network", async () => {
  for (const patch of [
    { VERCEL_ENV: "production" },
    { EYLO_ENVIRONMENT: "production" },
    { EYLO_STAGING_CONFIRMED_REF: "" },
    { EYLO_PRIVACY_WORKER_SECRET: "" },
    { EYLO_PRIVACY_DELETION_ENABLED: "false" },
    {
      EYLO_STAGING_SUPABASE_REF: "kbzjngpzxpniaumlupaa",
      EYLO_STAGING_CONFIRMED_REF: "kbzjngpzxpniaumlupaa",
      VITE_SUPABASE_URL: "https://kbzjngpzxpniaumlupaa.supabase.co",
    },
  ])
    await setup(async ({ state, call }) => {
      const res = await call(begin);
      assert.equal(res.statusCode, 503);
      assert.equal(state.calls.length, 0);
    }, patch);
});
test("password reauthentication and exact confirmation are required; caller-supplied user IDs cannot redirect deletion", () =>
  setup(async ({ state, call }) => {
    assert.equal(
      (await call({ ...begin, confirmation: "delete" })).statusCode,
      400,
    );
    assert.equal(state.calls.length, 0);
    assert.equal((await call(begin, {})).statusCode, 401);
    assert.equal(state.calls.length, 0);
    state.reauthOk = false;
    assert.equal((await call(begin)).statusCode, 401);
    assert.equal(
      state.calls.some((c) => c.path.endsWith("start_account_deletion")),
      false,
    );
    state.reauthOk = true;
    const res = await call({ ...begin, user_id: "other-user" });
    assert.equal(res.statusCode, 202);
    assert.equal(res.body.receipt_token, deletionReceipt(id));
    assert.equal(JSON.stringify(res.body).includes("ephemeral"), false);
    assert.ok(state.calls.some((c) => c.path === "/auth/v1/logout"));
  }));
test("reauthentication uses the existing atomic quota and billing review blocks mutation while cleaning proof session", () =>
  setup(async ({ state, call }) => {
    state.budget = false;
    assert.equal((await call(begin)).statusCode, 429);
    assert.equal(
      state.calls.some((c) => c.path === "/auth/v1/token"),
      false,
    );
    state.budget = true;
    state.billing = true;
    const res = await call(begin);
    assert.equal(res.statusCode, 409);
    assert.equal(res.body.error, "BILLING_REVIEW_REQUIRED");
    assert.ok(state.calls.some((c) => c.path === "/auth/v1/logout"));
    assert.equal(state.authDeleted, false);
  }));
test("receipt-bound resumable deletion removes Storage before Auth, confirms SQL completion and tolerates exact replay", () =>
  setup(async ({ state, call }) => {
    const started = await call(begin),
      receipt_token = started.body.receipt_token;
    assert.equal(
      (await call({ action: "resume", receipt_token })).body.phase,
      "storage",
    );
    assert.equal(state.authDeleted, false);
    assert.equal(
      (await call({ action: "resume", receipt_token })).body.phase,
      "complete",
    );
    assert.equal(state.authDeleted, true);
    const count = state.calls.filter(
      (c) => c.path === "/auth/v1/admin/users/" + uid && c.method === "DELETE",
    ).length;
    assert.equal(
      (await call({ action: "resume", receipt_token })).body.phase,
      "complete",
    );
    assert.equal(
      state.calls.filter(
        (c) =>
          c.path === "/auth/v1/admin/users/" + uid && c.method === "DELETE",
      ).length,
      count,
    );
  }));
test("forged/cross-job receipts and worker credentials fail before touching a job", () =>
  setup(async ({ state, call }) => {
    assert.equal(
      (
        await call({
          action: "resume",
          receipt_token: deletionReceipt(id).replace(id, uid),
        })
      ).statusCode,
      401,
    );
    assert.equal((await call({ action: "worker" })).statusCode, 401);
    assert.equal(state.calls.length, 0);
    state.objects = [];
    assert.equal(
      (
        await call(
          { action: "worker" },
          { authorization: "Bearer " + env.EYLO_PRIVACY_WORKER_SECRET },
        )
      ).body.phase,
      "complete",
    );
  }));
test("Storage failure cannot delete Auth; a lost successful Auth response can resume through 404 and SQL verification", () =>
  setup(async ({ state, call }) => {
    const receipt_token = deletionReceipt(id);
    state.storageFailure = true;
    assert.equal(
      (await call({ action: "resume", receipt_token })).statusCode,
      503,
    );
    assert.equal(state.authDeleted, false);
    state.storageFailure = false;
    await call({ action: "resume", receipt_token });
    state.ambiguousDelete = true;
    assert.equal(
      (await call({ action: "resume", receipt_token })).statusCode,
      503,
    );
    assert.equal(state.authDeleted, true);
    assert.notEqual(state.phase, "complete");
    assert.equal(
      (await call({ action: "resume", receipt_token })).body.phase,
      "complete",
    );
  }));
test("active worker lease reports pending and cross-origin/malformed requests cannot mutate data", () =>
  setup(async ({ state, call }) => {
    state.busy = true;
    assert.equal(
      (await call({ action: "resume", receipt_token: deletionReceipt(id) }))
        .body.busy,
      true,
    );
    assert.equal(
      state.calls.some((c) => c.path.startsWith("/auth/v1/admin")),
      false,
    );
    state.calls = [];
    assert.equal(
      (
        await call(begin, {
          origin: "https://untrusted.example",
          host: "eyloai.vercel.app",
        })
      ).statusCode,
      403,
    );
    assert.equal(state.calls.length, 0);
    assert.equal((await call("[")).statusCode, 400);
    assert.equal((await call(null)).statusCode, 400);
  }));

test("MFA accounts and a mismatched reauthenticated identity cannot begin deletion", () =>
  setup(async ({ state, call }) => {
    state.mfa = true;
    assert.equal((await call(begin)).body.error, "MFA_VERIFICATION_REQUIRED");
    assert.equal(
      state.calls.some((c) => c.path.endsWith("start_account_deletion")),
      false,
    );
    state.mfa = false;
    state.wrongProof = true;
    assert.equal((await call(begin)).statusCode, 401);
    assert.equal(
      state.calls.some((c) => c.path.endsWith("start_account_deletion")),
      false,
    );
  }));
test("invalid Storage paths never trigger byte or Auth deletion", () =>
  setup(async ({ state, call }) => {
    state.objects = [
      { bucket: "eylo-files", path: uid + "/../foreign-object" },
    ];
    assert.equal(
      (await call({ action: "resume", receipt_token: deletionReceipt(id) }))
        .body.error,
      "INVALID_STORAGE_BATCH",
    );
    assert.equal(state.authDeleted, false);
    assert.equal(
      state.calls.some((c) => c.path.startsWith("/storage/v1/object/")),
      false,
    );
  }));

test("receipt progress consumes a bounded per-job quota before claiming a worker lease", () =>
  setup(async ({ state, call }) => {
    state.budget = false;
    const res = await call({
      action: "resume",
      receipt_token: deletionReceipt(id),
    });
    assert.equal(res.statusCode, 429);
    assert.equal(res.body.error, "DELETION_PROGRESS_RATE_LIMITED");
    assert.equal(
      state.calls.some((c) => c.path.endsWith("claim_account_deletion")),
      false,
    );
    assert.equal(state.authDeleted, false);
  }));
