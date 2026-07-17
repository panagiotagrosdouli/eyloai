import React, { useState } from "react";
import { Link } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { UserPlus, Mail, Lock, Loader2 } from "lucide-react";
import AuthLayout from "@/components/AuthLayout";
import GoogleIcon from "@/components/GoogleIcon";
import { requireSupabase } from "@/lib/supabaseClient";

export default function Register() {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);
  const [sent, setSent] = useState(false);

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError("");
    if (password !== confirmPassword) return setError("Passwords do not match");
    setLoading(true);
    try {
      const client = requireSupabase();
      const { data, error: signUpError } = await client.auth.signUp({
        email: email.trim(),
        password,
        options: { emailRedirectTo: `${window.location.origin}/` },
      });
      if (signUpError) throw signUpError;
      if (data.session) window.location.assign("/");
      else setSent(true);
    } catch (err) {
      setError(err.message || "Registration failed");
    } finally {
      setLoading(false);
    }
  };

  const handleGoogle = async () => {
    setError("");
    setLoading(true);
    try {
      const client = requireSupabase();
      const { error: oauthError } = await client.auth.signInWithOAuth({
        provider: "google",
        options: { redirectTo: `${window.location.origin}/` },
      });
      if (oauthError) throw oauthError;
    } catch (err) {
      setError(err.message || "Google registration failed");
      setLoading(false);
    }
  };

  if (sent) {
    return <AuthLayout icon={Mail} title="Check your email" subtitle={`We sent a confirmation link to ${email}`} footer={<Link to="/login" className="text-primary font-medium hover:underline">Back to login</Link>}><p className="text-sm text-center">Open the confirmation link to activate your account.</p></AuthLayout>;
  }

  return (
    <AuthLayout icon={UserPlus} title="Create your account" subtitle="Sign up to get started" footer={<>Already have an account? <Link to="/login" className="text-primary font-medium hover:underline">Log in</Link></>}>
      <Button variant="outline" className="w-full h-12 text-sm font-medium mb-6" onClick={handleGoogle} disabled={loading}><GoogleIcon className="w-5 h-5 mr-2" />Continue with Google</Button>
      <div className="relative mb-6"><div className="absolute inset-0 flex items-center"><div className="w-full border-t border-border" /></div><div className="relative flex justify-center text-xs uppercase"><span className="bg-card px-3 text-muted-foreground">or</span></div></div>
      {error && <div className="mb-4 p-3 rounded-lg bg-destructive/10 text-destructive text-sm">{error}</div>}
      <form onSubmit={handleSubmit} className="space-y-4">
        <div className="space-y-2"><Label htmlFor="email">Email</Label><div className="relative"><Mail className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" /><Input id="email" type="email" autoComplete="email" autoFocus placeholder="you@example.com" value={email} onChange={(e) => setEmail(e.target.value)} className="pl-10 h-12" required /></div></div>
        <div className="space-y-2"><Label htmlFor="password">Password</Label><div className="relative"><Lock className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" /><Input id="password" type="password" autoComplete="new-password" placeholder="••••••••" value={password} onChange={(e) => setPassword(e.target.value)} className="pl-10 h-12" minLength={6} required /></div></div>
        <div className="space-y-2"><Label htmlFor="confirm">Confirm Password</Label><div className="relative"><Lock className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" /><Input id="confirm" type="password" autoComplete="new-password" placeholder="••••••••" value={confirmPassword} onChange={(e) => setConfirmPassword(e.target.value)} className="pl-10 h-12" minLength={6} required /></div></div>
        <Button type="submit" className="w-full h-12 font-medium" disabled={loading}>{loading ? <><Loader2 className="w-4 h-4 mr-2 animate-spin" />Creating account...</> : "Create account"}</Button>
      </form>
    </AuthLayout>
  );
}
