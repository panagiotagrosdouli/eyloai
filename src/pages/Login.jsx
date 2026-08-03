import React, { useState } from "react";
import { Link, useNavigate, useSearchParams } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Github, LogIn, Mail, Lock, Loader2, WandSparkles } from "lucide-react";
import AuthLayout from "@/components/AuthLayout";
import GoogleIcon from "@/components/GoogleIcon";
import { getSafeRedirect } from "@/lib/auth/safeRedirect";
import { useAuth } from "@/lib/AuthContext";

export default function Login() {
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const { signIn, signInWithProvider, signInWithMagicLink } = useAuth();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);
  const [magicLinkSent, setMagicLinkSent] = useState(false);

  const destination = getSafeRedirect(searchParams.get("from"));

  const handleSubmit = async (event) => {
    event.preventDefault();
    setError("");
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

  const handleProvider = async (provider) => {
    setError("");
    setLoading(true);
    const result = await signInWithProvider(provider, callbackUrl());
    if (!result.ok) {
      setError(result.error.message);
      setLoading(false);
    }
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
      title="Welcome back"
      subtitle="Log in to your account"
      footer={
        <>
          Don&apos;t have an account?{" "}
          <Link to="/register" className="text-primary font-medium hover:underline">
            Create one
          </Link>
        </>
      }
    >
      <div className="grid grid-cols-2 gap-3 mb-6">
        <Button variant="outline" className="h-12 text-sm font-medium" onClick={() => handleProvider('google')} disabled={loading}>
          <GoogleIcon className="w-5 h-5 mr-2" />Google
        </Button>
        <Button variant="outline" className="h-12 text-sm font-medium" onClick={() => handleProvider('github')} disabled={loading}>
          <Github className="w-5 h-5 mr-2" />GitHub
        </Button>
      </div>

      <div className="relative mb-6">
        <div className="absolute inset-0 flex items-center"><div className="w-full border-t border-border" /></div>
        <div className="relative flex justify-center text-xs uppercase"><span className="bg-card px-3 text-muted-foreground">or</span></div>
      </div>

      {error && <div role="alert" aria-live="polite" className="mb-4 p-3 rounded-lg bg-destructive/10 text-destructive text-sm">{error}</div>}
      {magicLinkSent && <div role="status" className="mb-4 rounded-lg border border-cyan-300/20 bg-cyan-400/10 p-3 text-sm text-cyan-100">Check your email — your secure sign-in link is on its way.</div>}

      <form onSubmit={handleSubmit} className="space-y-4" noValidate>
        <div className="space-y-2">
          <Label htmlFor="email">Email</Label>
          <div className="relative">
            <Mail className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" aria-hidden="true" />
            <Input id="email" type="email" autoComplete="email" autoFocus placeholder="you@example.com" value={email} onChange={(event) => setEmail(event.target.value)} className="pl-10 h-12" required disabled={loading} />
          </div>
        </div>
        <div className="space-y-2">
          <div className="flex items-center justify-between">
            <Label htmlFor="password">Password</Label>
            <Link to="/forgot-password" className="text-xs text-primary hover:underline">Forgot password?</Link>
          </div>
          <div className="relative">
            <Lock className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" aria-hidden="true" />
            <Input id="password" type="password" autoComplete="current-password" placeholder="••••••••" value={password} onChange={(event) => setPassword(event.target.value)} className="pl-10 h-12" required disabled={loading} />
          </div>
        </div>
        <Button type="submit" className="w-full h-12 font-medium" disabled={loading}>
          {loading ? <><Loader2 className="w-4 h-4 mr-2 animate-spin" />Logging in...</> : "Log in"}
        </Button>
        <Button type="button" variant="outline" className="w-full h-12 font-medium" disabled={loading} onClick={handleMagicLink}>
          <WandSparkles className="mr-2 h-4 w-4" />Email me a magic link
        </Button>
      </form>
    </AuthLayout>
  );
}
