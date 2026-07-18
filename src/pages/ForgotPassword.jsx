import React, { useState } from "react";
import { Link } from "react-router-dom";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Mail, ArrowLeft, Loader2 } from "lucide-react";
import AuthLayout from "@/components/AuthLayout";
import { useAuth } from "@/lib/AuthContext";
import { forgotPasswordSchema } from "@/lib/validation/auth";

export default function ForgotPassword() {
  const { resetPassword } = useAuth();
  const [sent, setSent] = useState(false);
  const [formError, setFormError] = useState("");
  const { register, handleSubmit, formState: { errors, isSubmitting } } = useForm({
    resolver: zodResolver(forgotPasswordSchema),
    defaultValues: { email: "" },
  });

  const onSubmit = async ({ email }) => {
    setFormError("");
    const result = await resetPassword(email, `${window.location.origin}/reset-password`);
    if (!result.ok) {
      setFormError(result.error.message);
      return;
    }
    setSent(true);
  };

  return (
    <AuthLayout icon={Mail} title="Reset password" subtitle="We'll send you a link to reset it" footer={<Link to="/login" className="text-primary font-medium hover:underline"><ArrowLeft className="w-3 h-3 inline mr-1" />Back to log in</Link>}>
      {sent ? (
        <p role="status" className="text-sm text-foreground text-center">If an account exists with that email, you'll receive a password reset link shortly.</p>
      ) : (
        <form onSubmit={handleSubmit(onSubmit)} className="space-y-4" noValidate>
          {formError && <div role="alert" aria-live="polite" className="p-3 rounded-lg bg-destructive/10 text-destructive text-sm">{formError}</div>}
          <div className="space-y-2"><Label htmlFor="email">Email address</Label><div className="relative"><Mail className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" aria-hidden="true" /><Input id="email" type="email" autoComplete="email" autoFocus placeholder="you@example.com" className="pl-10 h-12" aria-invalid={Boolean(errors.email)} disabled={isSubmitting} {...register("email")} /></div>{errors.email && <p role="alert" className="text-xs text-destructive">{errors.email.message}</p>}</div>
          <Button type="submit" className="w-full h-12 font-medium" disabled={isSubmitting}>{isSubmitting ? <><Loader2 className="w-4 h-4 mr-2 animate-spin" />Sending...</> : "Send reset link"}</Button>
        </form>
      )}
    </AuthLayout>
  );
}
