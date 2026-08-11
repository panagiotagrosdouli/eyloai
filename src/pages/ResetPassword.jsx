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
    return (
      <AuthLayout
        icon={Lock}
        title="Workspace access restored"
        subtitle="Your password has been updated."
        footer={<Link to="/login" className="font-medium text-cyan-300 hover:underline">Continue to sign in</Link>}
      >
        <div role="status" className="rounded-xl border border-emerald-300/15 bg-emerald-300/[0.05] p-4 text-sm leading-6 text-emerald-100">
          You can now return to your saved evidence, projects and EYRA work with the new password.
        </div>
      </AuthLayout>
    );
  }

  return (
    <AuthLayout icon={Lock} title="Choose a new password" subtitle="Set the password you will use for your EYLO workspace.">
      {formError && (
        <div role="alert" aria-live="polite" className="mb-4 rounded-lg border border-red-400/15 bg-red-400/[0.06] p-3 text-sm text-red-200">
          {formError}
        </div>
      )}

      <form onSubmit={handleSubmit(onSubmit)} className="space-y-4" noValidate>
        <div className="space-y-2">
          <Label htmlFor="password" className="text-slate-300">New password</Label>
          <div className="relative">
            <Lock className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-500" aria-hidden="true" />
            <Input id="password" type="password" autoComplete="new-password" autoFocus placeholder="••••••••"
              className="h-12 border-white/10 bg-white/[0.025] pl-10 text-white"
              aria-invalid={Boolean(errors.password)} disabled={isSubmitting} {...register("password")} />
          </div>
          {errors.password && <p role="alert" className="text-xs text-red-300">{errors.password.message}</p>}
        </div>

        <div className="space-y-2">
          <Label htmlFor="confirmPassword" className="text-slate-300">Confirm new password</Label>
          <div className="relative">
            <Lock className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-500" aria-hidden="true" />
            <Input id="confirmPassword" type="password" autoComplete="new-password" placeholder="••••••••"
              className="h-12 border-white/10 bg-white/[0.025] pl-10 text-white"
              aria-invalid={Boolean(errors.confirmPassword)} disabled={isSubmitting} {...register("confirmPassword")} />
          </div>
          {errors.confirmPassword && <p role="alert" className="text-xs text-red-300">{errors.confirmPassword.message}</p>}
        </div>

        <Button type="submit" className="h-12 w-full font-semibold" disabled={isSubmitting}>
          {isSubmitting ? <><Loader2 className="mr-2 h-4 w-4 animate-spin" />Updating password…</> : "Update password"}
        </Button>
      </form>
    </AuthLayout>
  );
}
