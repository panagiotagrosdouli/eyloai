import React, { useState } from "react";
import { Link } from "react-router-dom";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { UserPlus, Mail, Lock, Loader2, ShieldCheck } from "lucide-react";
import AuthLayout from "@/components/AuthLayout";
import { useAuth } from "@/lib/AuthContext";
import { registrationSchema } from "@/lib/validation/auth";

export default function Register() {
  const { signUp } = useAuth();
  const [formError, setFormError] = useState("");
  const [sentEmail, setSentEmail] = useState("");
  const { register, handleSubmit, formState: { errors, isSubmitting } } = useForm({
    resolver: zodResolver(registrationSchema),
    defaultValues: { email: "", password: "", confirmPassword: "" },
  });

  const onSubmit = async ({ email, password }) => {
    setFormError("");
    const result = await signUp(email, password, {
      emailRedirectTo: `${window.location.origin}/auth/callback`,
    });
    if (!result.ok) {
      setFormError(result.error.message);
      return;
    }
    setSentEmail(email);
  };

  if (sentEmail) {
    return <AuthLayout icon={Mail} title="Check your email" subtitle={`We sent a confirmation link to ${sentEmail}`} footer={<Link to="/login" className="text-primary font-medium hover:underline">Back to login</Link>}><p className="text-sm text-center">Open the confirmation link to activate your account.</p></AuthLayout>;
  }

  return (
    <AuthLayout icon={UserPlus} title="Create your account" subtitle="Sign up to get started" footer={<>Already have an account? <Link to="/login" className="text-primary font-medium hover:underline">Log in</Link></>}>
      <div className="mb-6 flex items-start gap-3 rounded-xl border border-cyan-300/20 bg-cyan-400/10 p-4 text-sm text-cyan-50"><ShieldCheck className="mt-0.5 h-5 w-5 shrink-0 text-cyan-300" aria-hidden="true" /><p>Create your secure EYLO account with email. A confirmation link will be sent to you.</p></div>
      {formError && <div role="alert" aria-live="polite" className="mb-4 p-3 rounded-lg bg-destructive/10 text-destructive text-sm">{formError}</div>}
      <form onSubmit={handleSubmit(onSubmit)} className="space-y-4" noValidate>
        <div className="space-y-2"><Label htmlFor="email">Email</Label><div className="relative"><Mail className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" aria-hidden="true" /><Input id="email" type="email" autoComplete="email" autoFocus placeholder="you@example.com" className="pl-10 h-12" aria-invalid={Boolean(errors.email)} disabled={isSubmitting} {...register("email")} /></div>{errors.email && <p role="alert" className="text-xs text-destructive">{errors.email.message}</p>}</div>
        <div className="space-y-2"><Label htmlFor="password">Password</Label><div className="relative"><Lock className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" aria-hidden="true" /><Input id="password" type="password" autoComplete="new-password" placeholder="••••••••" className="pl-10 h-12" aria-invalid={Boolean(errors.password)} disabled={isSubmitting} {...register("password")} /></div>{errors.password && <p role="alert" className="text-xs text-destructive">{errors.password.message}</p>}</div>
        <div className="space-y-2"><Label htmlFor="confirmPassword">Confirm Password</Label><div className="relative"><Lock className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" aria-hidden="true" /><Input id="confirmPassword" type="password" autoComplete="new-password" placeholder="••••••••" className="pl-10 h-12" aria-invalid={Boolean(errors.confirmPassword)} disabled={isSubmitting} {...register("confirmPassword")} /></div>{errors.confirmPassword && <p role="alert" className="text-xs text-destructive">{errors.confirmPassword.message}</p>}</div>
        <Button type="submit" className="w-full h-12 font-medium" disabled={isSubmitting}>{isSubmitting ? <><Loader2 className="w-4 h-4 mr-2 animate-spin" />Creating account...</> : "Create account"}</Button>
      </form>
    </AuthLayout>
  );
}
