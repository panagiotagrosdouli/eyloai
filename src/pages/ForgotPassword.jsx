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
    <AuthLayout
      icon={Mail}
      title="Recover workspace access"
      subtitle="Request a secure link to choose a new password."
      footer={
        <Link to="/login" className="font-medium text-cyan-300 hover:underline">
          <ArrowLeft className="mr-1 inline h-3 w-3" />Back to sign in
        </Link>
      }
    >
      {sent ? (
        <div role="status" className="rounded-xl border border-emerald-300/15 bg-emerald-300/[0.05] p-4 text-sm leading-6 text-emerald-100">
          If an account exists with that email, a password-reset link will arrive shortly. This message is intentionally the same for every address.
        </div>
      ) : (
        <form onSubmit={handleSubmit(onSubmit)} className="space-y-4" noValidate>
          {formError && (
            <div role="alert" aria-live="polite" className="rounded-lg border border-red-400/15 bg-red-400/[0.06] p-3 text-sm text-red-200">
              {formError}
            </div>
          )}

          <div className="space-y-2">
            <Label htmlFor="email" className="text-slate-300">Email address</Label>
            <div className="relative">
              <Mail className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-500" aria-hidden="true" />
              <Input id="email" type="email" autoComplete="email" autoFocus placeholder="you@example.com"
                className="h-12 border-white/10 bg-white/[0.025] pl-10 text-white"
                aria-invalid={Boolean(errors.email)} disabled={isSubmitting} {...register("email")} />
            </div>
            {errors.email && <p role="alert" className="text-xs text-red-300">{errors.email.message}</p>}
          </div>

          <Button type="submit" className="h-12 w-full font-semibold" disabled={isSubmitting}>
            {isSubmitting ? <><Loader2 className="mr-2 h-4 w-4 animate-spin" />Sending secure link…</> : "Send password-reset link"}
          </Button>
        </form>
      )}
    </AuthLayout>
  );
}
