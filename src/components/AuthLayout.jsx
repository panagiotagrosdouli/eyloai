import React from 'react';
import { Link } from 'react-router-dom';
import {
  ArrowLeft,
  ShieldCheck,
} from 'lucide-react';
import BrandLogo from '@/components/brand/BrandLogo';

export default function AuthLayout({ icon: Icon, title, footer, children }) {
  return (
    <main className="relative min-h-screen overflow-hidden bg-[#050810] text-slate-100 lg:grid lg:grid-cols-[minmax(0,1.06fr)_minmax(27rem,0.94fr)]">
      <div
        className="pointer-events-none absolute inset-0 bg-[radial-gradient(circle_at_18%_14%,rgba(37,99,235,0.14),transparent_32%),radial-gradient(circle_at_82%_78%,rgba(124,58,237,0.08),transparent_30%)]"
        aria-hidden="true"
      />

      <section className="relative hidden min-h-screen border-r border-white/[0.07] px-10 py-10 lg:flex lg:flex-col xl:px-16 xl:py-12">
        <Link to="/" className="flex w-fit items-center" aria-label="Back to EYLO">
          <BrandLogo brand="eylo" size="panel" priority />
        </Link>

        <div className="my-auto max-w-2xl py-16">
          <h2 className="mt-6 max-w-xl font-heading text-5xl font-semibold leading-[1.04] tracking-[-0.045em] text-white xl:text-6xl">
            Continue.
          </h2>
          <p className="mt-5 text-base text-slate-400">Your work is waiting.</p>
        </div>

        <div className="flex items-center gap-2 text-[10px] leading-5 text-slate-600">
          <ShieldCheck size={13} className="shrink-0 text-emerald-300/70" aria-hidden="true" />
          Secure Supabase authentication.
        </div>
      </section>

      <section className="relative flex min-h-screen flex-col px-5 py-6 sm:px-8 sm:py-8 lg:px-10 xl:px-16">
        <div className="flex items-center justify-between lg:justify-end">
          <Link to="/" className="flex items-center lg:hidden" aria-label="EYLO home">
            <BrandLogo brand="eylo" size="nav" priority />
          </Link>
          <Link
            to="/discover"
            className="inline-flex items-center gap-2 rounded-lg px-3 py-2 text-xs font-medium text-slate-400 transition-colors hover:text-white"
          >
            <ArrowLeft size={13} aria-hidden="true" /> Explore evidence
          </Link>
        </div>

        <div className="flex flex-1 items-center justify-center py-10">
          <div className="w-full max-w-md">
            <div className="mb-7">
              {Icon && (
                <div className="mb-5 grid h-11 w-11 place-items-center rounded-xl border border-white/[0.08] bg-white/[0.03] text-cyan-200">
                  <Icon className="h-5 w-5" aria-hidden="true" />
                </div>
              )}

              <h1 className="font-heading text-3xl font-semibold tracking-[-0.035em] text-white sm:text-4xl">
                {title}
              </h1>
            </div>

            <div className="rounded-[1.5rem] border border-white/[0.08] bg-[#090e1a] p-5 shadow-[0_28px_80px_-45px_rgba(37,99,235,0.35)] sm:p-7">
              {children}
            </div>

            {footer && <div className="mt-6 text-center text-sm text-slate-500">{footer}</div>}
          </div>
        </div>
      </section>
    </main>
  );
}
