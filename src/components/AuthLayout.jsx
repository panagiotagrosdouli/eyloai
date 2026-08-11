import React from 'react';
import { Link } from 'react-router-dom';
import {
  ArrowLeft,
  Brain,
  FileSearch,
  FolderKanban,
  ShieldCheck,
} from 'lucide-react';

const CONTINUITY = [
  {
    icon: FileSearch,
    label: 'Evidence stays connected',
    detail: 'Saved records keep their source and research context.',
  },
  {
    icon: Brain,
    label: 'EYRA keeps the thread',
    detail: 'Reasoning remains attached to the project it supports.',
  },
  {
    icon: FolderKanban,
    label: 'Work resumes with an action',
    detail: 'Return to milestones, decisions and the next validation step.',
  },
];

export default function AuthLayout({ icon: Icon, title, subtitle, footer, children }) {
  return (
    <main className="relative min-h-screen overflow-hidden bg-[#050810] text-slate-100 lg:grid lg:grid-cols-[minmax(0,1.06fr)_minmax(27rem,0.94fr)]">
      <div
        className="pointer-events-none absolute inset-0 bg-[radial-gradient(circle_at_18%_14%,rgba(37,99,235,0.14),transparent_32%),radial-gradient(circle_at_82%_78%,rgba(124,58,237,0.08),transparent_30%)]"
        aria-hidden="true"
      />

      <section className="relative hidden min-h-screen border-r border-white/[0.07] px-10 py-10 lg:flex lg:flex-col xl:px-16 xl:py-12">
        <Link to="/" className="flex w-fit items-center gap-3" aria-label="Back to EYLO">
          <img
            src="/brand/eylo-logo.svg"
            alt=""
            className="h-10 w-14 rounded-xl border border-white/10 bg-white/[0.03] object-contain p-1"
          />
          <span>
            <span className="block text-sm font-semibold tracking-[0.08em]">EYLO</span>
            <span className="block text-[8px] uppercase tracking-[0.2em] text-slate-500">Research workspace</span>
          </span>
        </Link>

        <div className="my-auto max-w-2xl py-16">
          <p className="font-mono text-[10px] font-semibold uppercase tracking-[0.22em] text-cyan-300">
            Private research continuity
          </p>
          <h2 className="mt-6 max-w-xl font-heading text-5xl font-semibold leading-[1.04] tracking-[-0.045em] text-white xl:text-6xl">
            Continue the research, not another empty chat.
          </h2>
          <p className="mt-6 max-w-xl text-base leading-7 text-slate-400">
            Sign in to return to the evidence, reasoning and project decisions already connected to your work.
          </p>

          <div className="mt-12 divide-y divide-white/[0.07] border-y border-white/[0.07]">
            {CONTINUITY.map(({ icon: StepIcon, label, detail }) => (
              <div key={label} className="grid grid-cols-[2.75rem_1fr] gap-4 py-5">
                <span className="grid h-10 w-10 place-items-center rounded-xl border border-cyan-300/10 bg-cyan-300/[0.04] text-cyan-200">
                  <StepIcon size={16} aria-hidden="true" />
                </span>
                <div>
                  <p className="text-sm font-semibold text-slate-100">{label}</p>
                  <p className="mt-1 text-xs leading-5 text-slate-500">{detail}</p>
                </div>
              </div>
            ))}
          </div>
        </div>

        <div className="flex items-center gap-2 text-[10px] leading-5 text-slate-600">
          <ShieldCheck size={13} className="shrink-0 text-emerald-300/70" aria-hidden="true" />
          Authentication is handled through the configured Supabase project. EYLO never places private service credentials in the browser.
        </div>
      </section>

      <section className="relative flex min-h-screen flex-col px-5 py-6 sm:px-8 sm:py-8 lg:px-10 xl:px-16">
        <div className="flex items-center justify-between lg:justify-end">
          <Link to="/" className="flex items-center gap-2 lg:hidden" aria-label="EYLO home">
            <img
              src="/brand/eylo-logo.svg"
              alt=""
              className="h-10 w-14 rounded-xl border border-white/10 bg-white/[0.03] object-contain p-1"
            />
            <span className="text-sm font-semibold tracking-[0.08em]">EYLO</span>
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
              <div className="mb-5 inline-flex items-center gap-2 rounded-full border border-cyan-300/15 bg-cyan-300/[0.05] px-3 py-1.5 font-mono text-[9px] uppercase tracking-[0.16em] text-cyan-200">
                <ShieldCheck size={12} aria-hidden="true" /> Secure workspace access
              </div>

              {Icon && (
                <div className="mb-5 grid h-11 w-11 place-items-center rounded-xl border border-white/[0.08] bg-white/[0.03] text-cyan-200">
                  <Icon className="h-5 w-5" aria-hidden="true" />
                </div>
              )}

              <h1 className="font-heading text-3xl font-semibold tracking-[-0.035em] text-white sm:text-4xl">
                {title}
              </h1>
              {subtitle && <p className="mt-3 max-w-sm text-sm leading-6 text-slate-400">{subtitle}</p>}
            </div>

            <div className="rounded-[1.5rem] border border-white/[0.08] bg-[#090e1a] p-5 shadow-[0_28px_80px_-45px_rgba(37,99,235,0.35)] sm:p-7">
              {children}
            </div>

            {footer && <div className="mt-6 text-center text-sm text-slate-500">{footer}</div>}

            <p className="mt-5 text-center text-[10px] leading-5 text-slate-600">
              Public evidence discovery remains available without an account.
            </p>
          </div>
        </div>
      </section>
    </main>
  );
}
