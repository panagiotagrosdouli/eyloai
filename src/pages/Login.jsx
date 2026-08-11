import React, { useState } from "react";
import { Link, useNavigate, useSearchParams } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { LogIn, Mail, Lock, Loader2, ShieldCheck, WandSparkles } from "lucide-react";
import AuthLayout from "@/components/AuthLayout";
import { getSafeRedirect } from "@/lib/auth/safeRedirect";
import { useAuth } from "@/lib/AuthContext";

export default function Login() {
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const { signIn, signInWithMagicLink } = useAuth();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);
  const [magicLinkSent, setMagicLinkSent] = useState(false);

  const destination = getSafeRedirect(searchParams.get("from"));
  const registerHref = destination === "/home"
    ? "/register"
    : `/register?from=${encodeURIComponent(destination)}`;
  const forgotHref = destination === "/home"
    ? "/forgot-password"
    : `/forgot-password?from=${encodeURIComponent(destination)}`;

  const handleSubmit = async (event) => {
    event.preventDefault();
    setError("");
    setMagicLinkSent(false);
    setLoading(true);

    const result = await signIn(email, password);
    if (!result.ok) {
      setError(result.error.message);
      setLoading(false);
      return;
    }

    navigate(destination, { replace: true });
  };

  const callbackUrl = () => {
    const url = new URL("/auth/callback", window.location.origin);
    url.searchParams.set("from", destination);
    return url.toString();
  };

  const handleMagicLink = async () => {
    setError("");
    setMagicLinkSent(false);
    if (!email.trim()) {
      setError("Enter your email address first.");
      return;
    }

    setLoading(true);
    const result = await signInWithMagicLink(email, callbackUrl());
    setLoading(false);
    if (!result.ok) {
      setError(result.error.message);
      return;
    }
    setMagicLinkSent(true);
  };

  return (
    <AuthLayout
      icon={LogIn}
      title="Continue your research"
      subtitle="Return to your saved evidence, project decisions and EYRA context."
      footer={
        <>
          New to EYLO?{" "}
          <Link to={registerHref} className="font-medium text-cyan-300 hover:underline">
            Create a private workspace
          </Link>
        </>
      }
    >
      <div className="mb-6 flex items-start gap-3 rounded-xl border border-cyan-300/15 bg-cyan-300/[0.05] p-4 text-sm leading-6 text-slate-300">
        <ShieldCheck className="mt-0.5 h-4 w-4 shrink-0 text-cyan-300" aria-hidden="true" />
        <p>Use your password or request a one-time sign-in link. You will return to the page that sent you here.</p>
      </div>

      {error && (
        <div role="alert" aria-live="polite" className="mb-4 rounded-lg border border-red-400/15 bg-red-400/[0.06] p-3 text-sm text-red-200">
          {error}
        </div>
      )}

      {magicLinkSent && (
        <div role="status" className="mb-4 rounded-lg border border-emerald-300/15 bg-emerald-300/[0.05] p-3 text-sm text-emerald-100">
          Check your email. The secure link will return you to your EYLO workspace.
        </div>
      )}

      <form onSubmit={handleSubmit} className="space-y-4" noValidate>
        <div className="space-y-2">
          <Label htmlFor="email" className="text-slate-300">Email address</Label>
          <div className="relative">
            <Mail className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-500" aria-hidden="true" />
            <Input
              id="email"
              type="email"
              autoComplete="email"
              autoFocus
              placeholder="you@example.com"
              value={email}
              onChange={(event) => setEmail(event.target.value)}
              className="h-12 border-white/10 bg-white/[0.025] pl-10 text-white"
              required
              disabled={loading}
            />
          </div>
        </div>

        <div className="space-y-2">
          <div className="flex items-center justify-between">
            <Label htmlFor="password" className="text-slate-300">Password</Label>
            <Link to={forgotHref} className="text-xs text-cyan-300 hover:underline">
              Forgot password?
            </Link>
          </div>
          <div className="relative">
            <Lock className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-500" aria-hidden="true" />
            <Input
              id="password"
              type="password"
              autoComplete="current-password"
              placeholder="••••••••"
              value={password}
              onChange={(event) => setPassword(event.target.value)}
              className="h-12 border-white/10 bg-white/[0.025] pl-10 text-white"
              required
              disabled={loading}
            />
          </div>
        </div>

        <Button type="submit" className="h-12 w-full font-semibold" disabled={loading}>
          {loading ? (
            <><Loader2 className="mr-2 h-4 w-4 animate-spin" />Signing in…</>
          ) : (
            "Continue with password"
          )}
        </Button>

        <div className="flex items-center gap-3 text-[10px] uppercase tracking-[0.14em] text-slate-600">
          <span className="h-px flex-1 bg-white/[0.07]" />
          or
          <span className="h-px flex-1 bg-white/[0.07]" />
        </div>

        <Button
          type="button"
          variant="outline"
          className="h-12 w-full border-white/10 bg-transparent font-medium text-slate-200 hover:bg-white/[0.05]"
          disabled={loading}
          onClick={handleMagicLink}
        >
          <WandSparkles className="mr-2 h-4 w-4" /> Email me a secure sign-in link
        </Button>
      </form>
    </AuthLayout>
  );
}
