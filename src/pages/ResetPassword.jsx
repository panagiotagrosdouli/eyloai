import React, { useState } from "react";
import { Link } from "react-router-dom";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Lock, Loader2 } from "lucide-react";
import AuthLayout from "@/components/AuthLayout";
import { useAuth } from "@/lib/AuthContext";
import { resetPasswordSchema } from "@/lib/validation/auth";

export default function ResetPassword() {
  const { updatePassword } = useAuth();
  const [formError, setFormError] = useState("");
  const [done, setDone] = useState(false);
  const { register, handleSubmit, formState: { errors, isSubmitting } } = useForm({
    resolver: zodResolver(resetPasswordSchema),
    defaultValues: { password: "", confirmPassword: "" },
  });

  const onSubmit = async ({ password }) => {
    setFormError("");
    const result = await updatePassword(password);
    if (!result.ok) {
      setFormError(result.error.message);
      return;
    }
    setDone(true);
  };

  if (done) {
    return <AuthLayout icon={Lock} title="Password updated" subtitle="Your password has been changed" footer={<Link to="/login" className="text-primary font-medium hover:underline">Continue to login</Link>}><p role="status" className="text-sm text-center">You can now sign in with your new password.</p></AuthLayout>;
  }

  return (
    <AuthLayout icon={Lock} title="New password" subtitle="Enter your new password below">
      {formError && <div role="alert" aria-live="polite" className="mb-4 p-3 rounded-lg bg-destructive/10 text-destructive text-sm">{formError}</div>}
      <form onSubmit={handleSubmit(onSubmit)} className="space-y-4" noValidate>
        <div className="space-y-2"><Label htmlFor="password">New Password</Label><div className="relative"><Lock className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" aria-hidden="true" /><Input id="password" type="password" autoComplete="new-password" autoFocus placeholder="••••••••" className="pl-10 h-12" aria-invalid={Boolean(errors.password)} disabled={isSubmitting} {...register("password")} /></div>{errors.password && <p role="alert" className="text-xs text-destructive">{errors.password.message}</p>}</div>
        <div className="space-y-2"><Label htmlFor="confirmPassword">Confirm Password</Label><div className="relative"><Lock className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" aria-hidden="true" /><Input id="confirmPassword" type="password" autoComplete="new-password" placeholder="••••••••" className="pl-10 h-12" aria-invalid={Boolean(errors.confirmPassword)} disabled={isSubmitting} {...register("confirmPassword")} /></div>{errors.confirmPassword && <p role="alert" className="text-xs text-destructive">{errors.confirmPassword.message}</p>}</div>
        <Button type="submit" className="w-full h-12 font-medium" disabled={isSubmitting}>{isSubmitting ? <><Loader2 className="w-4 h-4 mr-2 animate-spin" />Resetting...</> : "Reset password"}</Button>
      </form>
    </AuthLayout>
  );
}
