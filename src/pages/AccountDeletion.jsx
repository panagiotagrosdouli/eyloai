import React, { useEffect, useRef, useState } from "react";
import { Link } from "react-router-dom";
import { useAuth } from "@/lib/AuthContext";
import { getUsableSession, requireSupabase } from "@/lib/supabaseClient";
import { clearOfflineVaults } from "@/lib/offline-vault.mjs";
import { downloadWorkspace } from "@/components/projects/ProjectDocumentWorkspace";
const CONFIRM = "DELETE MY EYLO ACCOUNT";
const messages = {
  BILLING_REVIEW_REQUIRED:
    "A billing account is linked. Contact support to resolve billing and retention before account deletion.",
  REAUTHENTICATION_FAILED:
    "The password could not be verified. Passwordless accounts need support-assisted identity verification.",
  REAUTHENTICATION_RATE_LIMITED:
    "Too many password verification attempts. Wait at least one minute before retrying.",
  MFA_VERIFICATION_REQUIRED:
    "This account requires additional identity verification. Contact support to complete deletion securely.",
  INVALID_DELETION_RECEIPT: "The deletion receipt is invalid.",
  VERIFIED_STAGING_REQUIRED: "Deletion is not enabled in this environment.",
};
const input =
  "mt-1 block w-full min-w-0 rounded-lg border border-border bg-background p-3 text-sm";
const button =
  "min-h-11 rounded-lg border border-border px-4 py-2 text-sm disabled:opacity-50";
async function post(body, authorization) {
  const response = await fetch("/api/account-deletion", {
    method: "POST",
    headers: {
      "content-type": "application/json",
      ...(authorization ? { authorization } : {}),
    },
    body: JSON.stringify(body),
    signal: AbortSignal.timeout(26000),
    cache: "no-store",
  });
  const result = await response.json();
  if (!response.ok)
    throw new Error(
      messages[result.error] ||
        "Deletion is not confirmed. Keep your receipt and retry, or contact support.",
    );
  return result;
}
export default function AccountDeletion() {
  const { user } = useAuth(),
    currentUser = useRef(user),
    owner = useRef(null),
    alive = useRef(true);
  const [available, setAvailable] = useState(null),
    [password, setPassword] = useState(""),
    [confirmation, setConfirmation] = useState(""),
    [consent, setConsent] = useState(false),
    [busy, setBusy] = useState(false),
    [error, setError] = useState(""),
    [receipt, setReceipt] = useState(""),
    [imported, setImported] = useState(""),
    [phase, setPhase] = useState(""),
    [localWarning, setLocalWarning] = useState("");
  useEffect(() => {
    currentUser.current = user;
  }, [user]);
  useEffect(() => {
    alive.current = true;
    const controller = new AbortController();
    fetch("/api/account-deletion", {
      cache: "no-store",
      signal: controller.signal,
    })
      .then((r) => r.json())
      .then((r) => {
        if (alive.current) setAvailable(r.available === true);
      })
      .catch(() => {
        if (alive.current) setAvailable(false);
      });
    return () => {
      alive.current = false;
      controller.abort();
    };
  }, []);
  async function continueDeletion(token = receipt) {
    setBusy(true);
    setError("");
    try {
      for (let batch = 0; batch < 5; batch++) {
        const result = await post({ action: "resume", receipt_token: token });
        if (!alive.current) return;
        if (
          !["queued", "pending", "storage", "auth", "complete"].includes(
            result.phase,
          )
        )
          throw new Error("Deletion progress could not be confirmed.");
        setPhase(result.phase);
        if (result.phase === "complete") {
          if (owner.current && currentUser.current?.id === owner.current) {
            try {
              clearOfflineVaults(window.localStorage);
              const { error: signoutError } =
                await requireSupabase().auth.signOut({ scope: "local" });
              if (signoutError && alive.current)
                setLocalWarning(
                  "The account was deleted, but this browser could not confirm local sign-out. Sign out before sharing this device.",
                );
            } catch {
              if (alive.current)
                setLocalWarning(
                  "The account was deleted. Clear this browser session before sharing this device.",
                );
            }
          }
          break;
        }
        if (result.busy) break;
      }
    } catch (failure) {
      if (alive.current)
        setError(
          failure.message || "Deletion is not confirmed. Keep your receipt.",
        );
    } finally {
      if (alive.current) setBusy(false);
    }
  }
  async function begin(event) {
    event.preventDefault();
    if (
      !window.confirm(
        "Permanently delete your EYLO workspace, uploaded files and sign-in account? This cannot be undone.",
      )
    )
      return;
    setBusy(true);
    setError("");
    try {
      const session = await getUsableSession({
        required: true,
        validate: true,
      });
      const result = await post(
        { action: "begin", password, confirmation },
        "Bearer " + session.access_token,
      );
      if (!alive.current) return;
      if (
        typeof result.receipt_token !== "string" ||
        !result.receipt_token.startsWith("eylo_delete_") ||
        !["queued", "storage", "auth", "complete"].includes(result.phase)
      )
        throw new Error(
          "Deletion request is not confirmed. Contact support if access is locked.",
        );
      owner.current = session.user.id;
      setReceipt(result.receipt_token);
      setPhase(result.phase);
    } catch (failure) {
      if (alive.current)
        setError(failure.message || "Deletion request could not be confirmed.");
    } finally {
      if (alive.current) {
        setPassword("");
        setBusy(false);
      }
    }
  }
  return (
    <main className="eylo-page mx-auto max-w-2xl space-y-5 pb-16">
      <Link to="/settings">Back to settings</Link>
      <h1 className="text-2xl font-bold">Delete your EYLO account</h1>
      <p className="text-sm text-muted-foreground">
        Export anything you need first. Deletion removes your EYLO workspace,
        uploaded files and sign-in account. Shared collaborations may close;
        other users' private work stays theirs. External provider records and
        legally retained backups follow their separate retention policies.
      </p>
      {available === null ? (
        <p role="status">Checking deletion availability…</p>
      ) : (
        !available && (
          <p role="status">
            Account deletion is not enabled in this environment. Contact support
            for an account-data request.
          </p>
        )
      )}
      {error && (
        <p
          role="alert"
          className="rounded-lg border border-destructive p-3 text-sm"
        >
          {error}
        </p>
      )}
      {localWarning && <p role="alert">{localWarning}</p>}
      {phase === "complete" ? (
        <section
          aria-label="Deletion completed"
          className="rounded-xl border border-border p-5"
        >
          <h2 className="font-semibold">Account deletion confirmed</h2>
          <p className="mt-2 text-sm">
            Your EYLO account, workspace and uploaded files have been removed.
            Previously downloaded files and exports on your devices are not
            erased by this process.
          </p>
        </section>
      ) : receipt ? (
        <section
          aria-label="Deletion progress"
          className="space-y-3 rounded-xl border border-border p-5"
        >
          <h2 className="font-semibold">Deletion requested</h2>
          <p role="status">
            Current step: {phase}. Access is locked while deletion completes.
          </p>
          <p className="text-sm">
            Keep a private receipt so you can continue if the connection fails.
            It only authorizes completion of this already confirmed deletion;
            never share it.
          </p>
          <button
            className={button}
            onClick={() =>
              downloadWorkspace(
                JSON.stringify(
                  {
                    format: "eylo-deletion-receipt-v1",
                    receipt_token: receipt,
                  },
                  null,
                  2,
                ),
                "eylo-deletion-receipt.json",
              )
            }
          >
            Download private deletion receipt
          </button>
          <button
            className={button}
            disabled={busy || !available}
            onClick={() => void continueDeletion()}
          >
            {busy ? "Deleting…" : "Continue confirmed deletion"}
          </button>
        </section>
      ) : (
        <>
          {user ? (
            <form
              onSubmit={begin}
              className="space-y-4 rounded-xl border border-border p-5"
            >
              <label className="block text-sm">
                Current password
                <input
                  className={input}
                  type="password"
                  autoComplete="current-password"
                  required
                  maxLength={1024}
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  disabled={busy}
                />
              </label>
              <label className="block text-sm">
                Type {CONFIRM}
                <input
                  className={input}
                  autoComplete="off"
                  required
                  value={confirmation}
                  onChange={(e) => setConfirmation(e.target.value)}
                  disabled={busy}
                />
              </label>
              <label className="flex items-start gap-2 text-sm">
                <input
                  type="checkbox"
                  checked={consent}
                  onChange={(e) => setConsent(e.target.checked)}
                  disabled={busy}
                />
                I understand that deletion is permanent and saved files will be
                removed.
              </label>
              <button
                className={button + " border-destructive text-destructive"}
                disabled={
                  busy ||
                  !available ||
                  !consent ||
                  confirmation !== CONFIRM ||
                  !password
                }
              >
                {busy ? "Verifying…" : "Confirm permanent account deletion"}
              </button>
              <p className="text-xs text-muted-foreground">
                Accounts using multifactor authentication, passwordless sign-in
                or linked billing require support-assisted verification and
                retention review.
              </p>
            </form>
          ) : (
            <Link to="/login?from=%2Faccount-deletion">
              Sign in to request account deletion
            </Link>
          )}
          <form
            onSubmit={(event) => {
              event.preventDefault();
              owner.current = null;
              setReceipt(imported.trim());
              setPhase("pending");
              setImported("");
            }}
            className="space-y-3 rounded-xl border border-border p-5"
          >
            <h2 className="font-semibold">Continue an existing deletion</h2>
            <label className="block text-sm">
              Private deletion receipt token
              <input
                className={input}
                type="password"
                autoComplete="off"
                maxLength={160}
                value={imported}
                onChange={(e) => setImported(e.target.value)}
              />
            </label>
            <button
              className={button}
              disabled={
                !available ||
                !/^eylo_delete_[a-f0-9-]{36}_[a-f0-9]{64}$/.test(
                  imported.trim(),
                )
              }
            >
              Use private deletion receipt
            </button>
          </form>
        </>
      )}
    </main>
  );
}
