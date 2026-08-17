import React, { useState } from "react";
import { Link, useSearchParams } from "react-router-dom";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { User, UserPlus, Mail, Lock, Loader2, ShieldCheck } from "lucide-react";
import AuthLayout from "@/components/AuthLayout";
import { useAuth } from "@/lib/AuthContext";
import { getSafeRedirect } from "@/lib/auth/safeRedirect";
import { registrationSchema } from "@/lib/validation/auth";

export default function Register() {
  const { signUp } = useAuth();
  const [searchParams] = useSearchParams();
  const [formError, setFormError] = useState("");
  const [sentEmail, setSentEmail] = useState("");
  const { register, handleSubmit, formState: { errors, isSubmitting } } = useForm({
    resolver: zodResolver(registrationSchema),
    defaultValues: { fullName: "", email: "", password: "", confirmPassword: "" },
  });

  const destination = getSafeRedirect(searchParams.get("from"));
  const loginHref = destination === "/home"
    ? "/login"
    : `/login?from=${encodeURIComponent(destination)}`;

  const onSubmit = async ({ fullName, email, password }) => {
    setFormError("");
    const callbackUrl = new URL("/auth/callback", window.location.origin);
    callbackUrl.searchParams.set("from", destination);

    const result = await signUp(email, password, {
      emailRedirectTo: callbackUrl.toString(),
      full_name: fullName.trim(),
    });
    if (!result.ok) {
      setFormError(result.error.message);
      return;
    }
    setSentEmail(email);
  };

  if (sentEmail) {
    return (
      <AuthLayout
        icon={Mail}
        title="Confirm your email"
        subtitle={`We sent a confirmation link to ${sentEmail}.`}
        footer={<Link to={loginHref} className="font-medium text-cyan-300 hover:underline">Back to sign in</Link>}
      >
        <div role="status" className="rounded-xl border border-emerald-300/15 bg-emerald-300/[0.05] p-4 text-sm leading-6 text-emerald-100">
          Open the link to verify your address. EYLO will then return you to the research page that sent you here.
        </div>
      </AuthLayout>
    );
  }

  return (
    <AuthLayout
      icon={UserPlus}
      title="Create your private workspace"
      subtitle="Save evidence, keep project context and continue where you left off."
      footer={
        <>
          Already have a workspace?{" "}
          <Link to={loginHref} className="font-medium text-cyan-300 hover:underline">Sign in</Link>
        </>
      }
    >
      <div className="mb-6 flex items-start gap-3 rounded-xl border border-cyan-300/15 bg-cyan-300/[0.05] p-4 text-sm leading-6 text-slate-300">
        <ShieldCheck className="mt-0.5 h-4 w-4 shrink-0 text-cyan-300" aria-hidden="true" />
        <p>Your email confirms access to saved evidence and projects. Public discovery remains available without an account.</p>
      </div>

      {formError && (
        <div role="alert" aria-live="polite" className="mb-4 rounded-lg border border-red-400/15 bg-red-400/[0.06] p-3 text-sm text-red-200">
          {formError}
        </div>
      )}

      <form onSubmit={handleSubmit(onSubmit)} className="space-y-4" noValidate>
        <div className="space-y-2">
          <Label htmlFor="fullName" className="text-slate-300">Preferred name</Label>
          <div className="relative">
            <User className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-500" aria-hidden="true" />
            <Input id="fullName" type="text" autoComplete="name" autoFocus placeholder="Alex Morgan"
              className="h-12 border-white/10 bg-white/[0.025] pl-10 text-white"
              aria-invalid={Boolean(errors.fullName)} disabled={isSubmitting} {...register("fullName")} />
          </div>
          {errors.fullName && <p role="alert" className="text-xs text-red-300">{errors.fullName.message}</p>}
        </div>

        <div className="space-y-2">
          <Label htmlFor="email" className="text-slate-300">Email address</Label>
          <div className="relative">
            <Mail className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-500" aria-hidden="true" />
            <Input id="email" type="email" autoComplete="email" placeholder="you@example.com"
              className="h-12 border-white/10 bg-white/[0.025] pl-10 text-white"
              aria-invalid={Boolean(errors.email)} disabled={isSubmitting} {...register("email")} />
          </div>
          {errors.email && <p role="alert" className="text-xs text-red-300">{errors.email.message}</p>}
        </div>

        <div className="space-y-2">
          <Label htmlFor="password" className="text-slate-300">Password</Label>
          <div className="relative">
            <Lock className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-500" aria-hidden="true" />
            <Input id="password" type="password" autoComplete="new-password" placeholder="••••••••"
              className="h-12 border-white/10 bg-white/[0.025] pl-10 text-white"
              aria-invalid={Boolean(errors.password)} disabled={isSubmitting} {...register("password")} />
          </div>
          {errors.password && <p role="alert" className="text-xs text-red-300">{errors.password.message}</p>}
        </div>

        <div className="space-y-2">
          <Label htmlFor="confirmPassword" className="text-slate-300">Confirm password</Label>
          <div className="relative">
            <Lock className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-500" aria-hidden="true" />
            <Input id="confirmPassword" type="password" autoComplete="new-password" placeholder="••••••••"
              className="h-12 border-white/10 bg-white/[0.025] pl-10 text-white"
              aria-invalid={Boolean(errors.confirmPassword)} disabled={isSubmitting} {...register("confirmPassword")} />
          </div>
          {errors.confirmPassword && <p role="alert" className="text-xs text-red-300">{errors.confirmPassword.message}</p>}
        </div>

        <Button type="submit" className="h-12 w-full font-semibold" disabled={isSubmitting}>
          {isSubmitting ? <><Loader2 className="mr-2 h-4 w-4 animate-spin" />Creating workspace…</> : "Create private workspace"}
        </Button>
      </form>
    </AuthLayout>
  );
}
