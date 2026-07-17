import React, { useState } from "react";
import { Link } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Lock, Loader2 } from "lucide-react";
import AuthLayout from "@/components/AuthLayout";
import { requireSupabase } from "@/lib/supabaseClient";

export default function ResetPassword() {
  const [newPassword, setNewPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);
  const [done, setDone] = useState(false);

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError("");
    if (newPassword !== confirmPassword) return setError("Passwords do not match");
    setLoading(true);
    try {
      const client = requireSupabase();
      const { error: updateError } = await client.auth.updateUser({ password: newPassword });
      if (updateError) throw updateError;
      setDone(true);
    } catch (err) {
      setError(err.message || "Failed to reset password. Open the reset link from your email again.");
    } finally {
      setLoading(false);
    }
  };

  if (done) {
    return <AuthLayout icon={Lock} title="Password updated" subtitle="Your password has been changed" footer={<Link to="/login" className="text-primary font-medium hover:underline">Continue to login</Link>}><p className="text-sm text-center">You can now sign in with your new password.</p></AuthLayout>;
  }

  return (
    <AuthLayout icon={Lock} title="New password" subtitle="Enter your new password below">
      {error && <div className="mb-4 p-3 rounded-lg bg-destructive/10 text-destructive text-sm">{error}</div>}
      <form onSubmit={handleSubmit} className="space-y-4">
        <div className="space-y-2"><Label htmlFor="password">New Password</Label><div className="relative"><Lock className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" aria-hidden="true" /><Input id="password" type="password" autoComplete="new-password" autoFocus placeholder="••••••••" value={newPassword} onChange={(e) => setNewPassword(e.target.value)} className="pl-10 h-12" minLength={6} required /></div></div>
        <div className="space-y-2"><Label htmlFor="confirm">Confirm Password</Label><div className="relative"><Lock className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" aria-hidden="true" /><Input id="confirm" type="password" autoComplete="new-password" placeholder="••••••••" value={confirmPassword} onChange={(e) => setConfirmPassword(e.target.value)} className="pl-10 h-12" minLength={6} required /></div></div>
        <Button type="submit" className="w-full h-12 font-medium" disabled={loading}>{loading ? <><Loader2 className="w-4 h-4 mr-2 animate-spin" />Resetting...</> : "Reset password"}</Button>
      </form>
    </AuthLayout>
  );
}
