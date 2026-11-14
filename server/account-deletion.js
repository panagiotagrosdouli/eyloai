import crypto from "node:crypto";
import { applyCors, isAllowedBrowserOrigin } from "../src/lib/api-cors.mjs";
import { verifyStagingConfig } from "../scripts/verify-staging-config.mjs";
import { readSupabaseApiConfig } from "./supabase-config.mjs";
const UUID = "[a-f0-9]{8}(?:-[a-f0-9]{4}){3}-[a-f0-9]{12}";
const uuid = (value) =>
  typeof value === "string" && new RegExp("^" + UUID + "$").test(value);
const CONFIRM = "DELETE MY EYLO ACCOUNT";
export function deletionAvailable(env = process.env) {
  return (
    env.EYLO_PRIVACY_DELETION_ENABLED === "true" &&
    // This candidate only handles isolated free-account staging. Do not allow
    // deletion alongside in-flight checkout/webhook activity before the full
    // billing cancellation/retention lifecycle is implemented and accepted.
    !env.STRIPE_SECRET_KEY &&
    !env.STRIPE_WEBHOOK_SECRET &&
    verifyStagingConfig(env).ok &&
    String(env.EYLO_PRIVACY_WORKER_SECRET || "").length >= 32 &&
    readSupabaseApiConfig(env).hasServerConfig
  );
}
function signature(id) {
  return crypto
    .createHmac("sha256", process.env.EYLO_PRIVACY_WORKER_SECRET)
    .update("eylo-deletion-receipt-v1:" + id)
    .digest("hex");
}
export function deletionReceipt(id) {
  return `eylo_delete_${id}_${signature(id)}`;
}
function secureEqual(a, b) {
  const first = Buffer.from(String(a)),
    second = Buffer.from(String(b));
  return (
    first.length === second.length && crypto.timingSafeEqual(first, second)
  );
}
function receiptId(token) {
  const match =
    typeof token === "string" &&
    token.match(new RegExp("^eylo_delete_(" + UUID + ")_([a-f0-9]{64})$"));
  return match && secureEqual(match[2], signature(match[1])) ? match[1] : null;
}
class DeletionError extends Error {
  constructor(code, status = 503) {
    super(code);
    this.status = status;
  }
}
function headers(key) {
  return {
    apikey: key,
    ...(key.startsWith("sb_") ? {} : { authorization: `Bearer ${key}` }),
    "content-type": "application/json",
  };
}
async function jsonRequest(config, path, options = {}, signal) {
  const response = await fetch(config.url + path, {
    ...options,
    cache: "no-store",
    signal: signal
      ? AbortSignal.any([signal, AbortSignal.timeout(5000)])
      : AbortSignal.timeout(5000),
  });
  if (!response.ok) {
    const body = await response.json().catch(() => ({}));
    if (body?.message === "BILLING_REVIEW_REQUIRED")
      throw new DeletionError("BILLING_REVIEW_REQUIRED", 409);
    throw new DeletionError("DELETION_SERVICE_UNAVAILABLE");
  }
  if (response.status === 204) return null;
  return response.json();
}
function rpc(config, name, body, signal) {
  return jsonRequest(
    config,
    "/rest/v1/rpc/" + name,
    {
      method: "POST",
      headers: headers(config.serverKey),
      body: JSON.stringify(body),
    },
    signal,
  );
}
async function runBatch(config, id) {
  const signal = AbortSignal.timeout(20000),
    lease = crypto.randomUUID();
  const job = await rpc(
    config,
    "claim_account_deletion",
    { p_id: id, p_lease: lease },
    signal,
  );
  if (!job) return { id, phase: "pending", busy: true };
  if (job.phase === "complete") return { id, phase: "complete" };
  if (!uuid(job.user_id)) throw new DeletionError("INVALID_DELETION_JOB");
  try {
    // Ban future sign-ins; restrictive SQL policies already block old JWT access.
    const ban = await fetch(
      config.url + "/auth/v1/admin/users/" + job.user_id,
      {
        method: "PUT",
        headers: headers(config.serverKey),
        body: JSON.stringify({ ban_duration: "876000h" }),
        signal: AbortSignal.any([signal, AbortSignal.timeout(5000)]),
      },
    );
    if (!ban.ok && ban.status !== 404)
      throw new DeletionError("ACCOUNT_LOCK_UNCONFIRMED");
    const objects = await rpc(
      config,
      "account_deletion_storage_batch",
      { p_id: id, p_lease: lease },
      signal,
    );
    if (!Array.isArray(objects) || objects.length > 100)
      throw new DeletionError("INVALID_STORAGE_BATCH");
    const buckets = new Map();
    for (const object of objects) {
      if (
        typeof object.bucket !== "string" ||
        !object.bucket ||
        object.bucket.length > 100 ||
        /[\\/\x00-\x1f]/.test(object.bucket) ||
        typeof object.path !== "string" ||
        !object.path ||
        object.path.startsWith("/") ||
        object.path.length > 2048 ||
        /[\\\x00-\x1f]/.test(object.path) ||
        object.path.split("/").some((p) => p === "." || p === "..")
      )
        throw new DeletionError("INVALID_STORAGE_BATCH");
      if (!buckets.has(object.bucket)) buckets.set(object.bucket, []);
      buckets.get(object.bucket).push(object.path);
    }
    let removed = 0;
    // Bound each HTTP invocation; a durable job and lease survive interruption.
    for (const [bucket, paths] of [...buckets].slice(0, 3)) {
      await jsonRequest(
        config,
        "/storage/v1/object/" + encodeURIComponent(bucket),
        {
          method: "DELETE",
          headers: headers(config.serverKey),
          body: JSON.stringify({ prefixes: paths }),
        },
        signal,
      );
      removed += paths.length;
    }
    await rpc(
      config,
      "progress_account_deletion",
      { p_id: id, p_lease: lease, p_removed: removed, p_phase: "storage" },
      signal,
    );
    if (objects.length)
      return {
        id,
        phase: "storage",
        objects_removed: Number(job.objects_removed || 0) + removed,
      };
    await rpc(
      config,
      "progress_account_deletion",
      { p_id: id, p_lease: lease, p_removed: 0, p_phase: "auth" },
      signal,
    );
    const deleted = await fetch(
      config.url + "/auth/v1/admin/users/" + job.user_id,
      {
        method: "DELETE",
        headers: headers(config.serverKey),
        body: JSON.stringify({ should_soft_delete: false }),
        signal: AbortSignal.any([signal, AbortSignal.timeout(5000)]),
      },
    );
    // A retry may follow an ambiguous successful deletion. SQL completion still
    // verifies absence of Auth/session/workspace/Storage before claiming success.
    if (!deleted.ok && deleted.status !== 404)
      throw new DeletionError("AUTH_DELETION_UNCONFIRMED");
    const result = await rpc(
      config,
      "finish_account_deletion",
      { p_id: id, p_lease: lease },
      signal,
    );
    if (result?.phase !== "complete")
      throw new DeletionError("DELETION_UNCONFIRMED");
    return { id, phase: "complete" };
  } finally {
    await rpc(config, "release_account_deletion", {
      p_id: id,
      p_lease: lease,
    }).catch(() => {});
  }
}
export default async function accountDeletion(req, res) {
  if (applyCors(req, res, ["GET", "POST"])) return;
  res.setHeader("Cache-Control", "private, no-store");
  if (!["GET", "POST"].includes(req.method))
    return res.status(405).json({ error: "METHOD_NOT_ALLOWED" });
  const available = deletionAvailable();
  if (req.method === "GET")
    return res
      .status(200)
      .json({ available, scope: "staging-only", confirmation: CONFIRM });
  if (!available)
    return res.status(503).json({ error: "VERIFIED_STAGING_REQUIRED" });
  if (
    req.headers?.origin &&
    !isAllowedBrowserOrigin(req.headers.origin, req.headers.host)
  )
    return res.status(403).json({ error: "ORIGIN_NOT_ALLOWED" });
  const config = readSupabaseApiConfig();
  try {
    const encoded =
      typeof req.body === "string" ? req.body : JSON.stringify(req.body);
    if (typeof encoded !== "string" || Buffer.byteLength(encoded) > 4096)
      return res.status(400).json({ error: "INVALID_REQUEST" });
    let body;
    try {
      body = JSON.parse(encoded);
    } catch {
      return res.status(400).json({ error: "INVALID_REQUEST" });
    }
    if (!body || typeof body !== "object" || Array.isArray(body))
      return res.status(400).json({ error: "INVALID_REQUEST" });
    if (body.action === "begin") {
      if (
        body.confirmation !== CONFIRM ||
        typeof body.password !== "string" ||
        body.password.length < 1 ||
        body.password.length > 1024
      )
        return res
          .status(400)
          .json({ error: "CONFIRMATION_AND_REAUTHENTICATION_REQUIRED" });
      const authorization = req.headers?.authorization;
      if (
        typeof authorization !== "string" ||
        !/^Bearer \S+$/.test(authorization)
      )
        return res.status(401).json({ error: "AUTHENTICATION_REQUIRED" });
      const auth = await fetch(config.url + "/auth/v1/user", {
        headers: { apikey: config.publicKey, authorization },
        signal: AbortSignal.timeout(5000),
        cache: "no-store",
      });
      if (!auth.ok)
        return res.status(401).json({ error: "AUTHENTICATION_REQUIRED" });
      const user = await auth.json();
      if (
        !uuid(user?.id) ||
        typeof user.email !== "string" ||
        !user.email ||
        user.is_anonymous
      )
        return res.status(401).json({ error: "AUTHENTICATION_REQUIRED" });
      if (
        Array.isArray(user.factors) &&
        user.factors.some((factor) => factor.status === "verified")
      )
        return res.status(409).json({ error: "MFA_VERIFICATION_REQUIRED" });
      const budget = await rpc(config, "consume_discovery_rate_limit", {
        p_subject_hash: crypto
          .createHmac("sha256", process.env.EYLO_PRIVACY_WORKER_SECRET)
          .update("eylo-deletion-reauth:" + user.id)
          .digest("hex"),
        p_limit: 5,
        p_window_seconds: 60,
      });
      if (!Array.isArray(budget) || budget[0]?.allowed !== true) {
        res.setHeader("Retry-After", "60");
        return res.status(429).json({ error: "REAUTHENTICATION_RATE_LIMITED" });
      }
      const proof = await fetch(
        config.url + "/auth/v1/token?grant_type=password",
        {
          method: "POST",
          headers: {
            apikey: config.publicKey,
            "content-type": "application/json",
          },
          body: JSON.stringify({ email: user.email, password: body.password }),
          signal: AbortSignal.timeout(5000),
          cache: "no-store",
        },
      );
      if (!proof.ok)
        return res.status(401).json({ error: "REAUTHENTICATION_FAILED" });
      const fresh = await proof.json();
      if (fresh?.user?.id !== user.id || typeof fresh.access_token !== "string")
        return res.status(401).json({ error: "REAUTHENTICATION_FAILED" });
      try {
        const job = await rpc(config, "start_account_deletion", {
          p_user_id: user.id,
          p_id: crypto.randomUUID(),
        });
        if (!uuid(job?.id)) throw new DeletionError("DELETION_UNCONFIRMED");
        return res.status(202).json({
          id: job.id,
          phase: job.phase,
          receipt_token: deletionReceipt(job.id),
        });
      } finally {
        // Remove the temporary reauthentication session even if billing/schema
        // checks reject the request. Never return/store its access/refresh token.
        await fetch(config.url + "/auth/v1/logout?scope=local", {
          method: "POST",
          headers: {
            apikey: config.publicKey,
            authorization: `Bearer ${fresh.access_token}`,
          },
          signal: AbortSignal.timeout(2000),
        }).catch(() => {});
      }
    }
    let id;
    if (body.action === "resume") {
      id = receiptId(body.receipt_token);
      if (!id)
        return res.status(401).json({ error: "INVALID_DELETION_RECEIPT" });
    } else if (body.action === "worker") {
      if (
        !secureEqual(
          req.headers?.authorization,
          "Bearer " + process.env.EYLO_PRIVACY_WORKER_SECRET,
        )
      )
        return res
          .status(401)
          .json({ error: "WORKER_AUTHENTICATION_REQUIRED" });
      id = await rpc(config, "pending_account_deletion", {});
      if (!id) return res.status(200).json({ phase: "idle" });
      if (!uuid(id)) throw new DeletionError("INVALID_DELETION_JOB");
    } else return res.status(400).json({ error: "INVALID_ACTION" });
    const progressBudget = await rpc(config, "consume_discovery_rate_limit", {
      p_subject_hash: crypto
        .createHmac("sha256", process.env.EYLO_PRIVACY_WORKER_SECRET)
        .update("eylo-deletion-progress:" + id)
        .digest("hex"),
      p_limit: 30,
      p_window_seconds: 60,
    });
    if (!Array.isArray(progressBudget) || progressBudget[0]?.allowed !== true) {
      res.setHeader("Retry-After", "60");
      return res.status(429).json({ error: "DELETION_PROGRESS_RATE_LIMITED" });
    }
    const result = await runBatch(config, id);
    return res.status(result.phase === "complete" ? 200 : 202).json(result);
  } catch (error) {
    return res
      .status(error instanceof DeletionError ? error.status : 503)
      .json({
        error:
          error instanceof DeletionError
            ? error.message
            : "DELETION_SERVICE_UNAVAILABLE",
        note: "Deletion is not confirmed. Keep your receipt and retry; a started request remains locked for recovery.",
      });
  }
}
