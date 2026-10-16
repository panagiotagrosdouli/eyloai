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

    try {
      const result = await signUp(email, password, {
        emailRedirectTo: callbackUrl.toString(),
        full_name: fullName.trim(),
      });
      if (!result.ok) {
        setFormError(result.error?.message || "Registration could not be completed.");
        return;
      }
      // Email confirmation is not always enabled. Only promise a confirmation
      // message when the provider did not issue a valid session.
      if (result.data?.session) {
        window.location.assign(destination);
        return;
      }
      setSentEmail(email);
    } catch {
      setFormError("We could not contact the account service. Please retry.");
    }
  };

  if (sentEmail) {
    return (
      <AuthLayout
        icon={Mail}
        title="Confirm your email"
        subtitle={`We sent a confirmation link to ${sentEmail}.`}
        footer={<Link to={loginHref} className="font-medium text-[#25578d] hover:underline">Back to sign in</Link>}
      >
        <div role="status" className="rounded-xl border border-emerald-200 bg-emerald-50 p-4 text-sm leading-6 text-emerald-800">
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
          <Link to={loginHref} className="font-medium text-[#25578d] hover:underline">Sign in</Link>
        </>
      }
    >
      <div className="mb-6 flex items-start gap-3 rounded-xl border border-slate-200 bg-slate-50 p-4 text-sm leading-6 text-slate-700">
        <ShieldCheck className="mt-0.5 h-4 w-4 shrink-0 text-[#356ba0]" aria-hidden="true" />
        <p>Your email confirms access to saved evidence and projects. Public discovery remains available without an account.</p>
      </div>

      {formError && (
        <div role="alert" aria-live="polite" className="mb-4 rounded-lg border border-red-200 bg-red-50 p-3 text-sm text-red-700">
          {formError}
        </div>
      )}

      <form onSubmit={handleSubmit(onSubmit)} className="space-y-4" noValidate>
        <div className="space-y-2">
          <Label htmlFor="fullName" className="text-slate-700">Preferred name</Label>
          <div className="relative">
            <User className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-500" aria-hidden="true" />
            <Input id="fullName" type="text" autoComplete="name" autoFocus placeholder="Alex Morgan"
              className="h-12 border-slate-200 bg-white pl-10 text-slate-900"
              aria-invalid={Boolean(errors.fullName)} disabled={isSubmitting} {...register("fullName")} />
          </div>
          {errors.fullName && <p role="alert" className="text-xs text-red-700">{errors.fullName.message}</p>}
        </div>

        <div className="space-y-2">
          <Label htmlFor="email" className="text-slate-700">Email address</Label>
          <div className="relative">
            <Mail className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-500" aria-hidden="true" />
            <Input id="email" type="email" autoComplete="email" placeholder="you@example.com"
              className="h-12 border-slate-200 bg-white pl-10 text-slate-900"
              aria-invalid={Boolean(errors.email)} disabled={isSubmitting} {...register("email")} />
          </div>
          {errors.email && <p role="alert" className="text-xs text-red-700">{errors.email.message}</p>}
        </div>

        <div className="space-y-2">
          <Label htmlFor="password" className="text-slate-700">Password</Label>
          <div className="relative">
            <Lock className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-500" aria-hidden="true" />
            <Input id="password" type="password" autoComplete="new-password" placeholder="••••••••"
              className="h-12 border-slate-200 bg-white pl-10 text-slate-900"
              aria-invalid={Boolean(errors.password)} disabled={isSubmitting} {...register("password")} />
          </div>
          {errors.password && <p role="alert" className="text-xs text-red-700">{errors.password.message}</p>}
        </div>

        <div className="space-y-2">
          <Label htmlFor="confirmPassword" className="text-slate-700">Confirm password</Label>
          <div className="relative">
            <Lock className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-500" aria-hidden="true" />
            <Input id="confirmPassword" type="password" autoComplete="new-password" placeholder="••••••••"
              className="h-12 border-slate-200 bg-white pl-10 text-slate-900"
              aria-invalid={Boolean(errors.confirmPassword)} disabled={isSubmitting} {...register("confirmPassword")} />
          </div>
          {errors.confirmPassword && <p role="alert" className="text-xs text-red-700">{errors.confirmPassword.message}</p>}
        </div>

        <Button type="submit" className="h-12 w-full rounded-xl font-semibold shadow-sm" disabled={isSubmitting}>
          {isSubmitting ? <><Loader2 className="mr-2 h-4 w-4 animate-spin" />Creating workspace…</> : "Create private workspace"}
        </Button>
      </form>
    </AuthLayout>
  );
}
