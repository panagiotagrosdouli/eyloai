import React from 'react';
import { Link } from 'react-router-dom';
import {
  ArrowLeft,
} from 'lucide-react';
import BrandLogo from '@/components/brand/BrandLogo';

export default function AuthLayout({ icon: Icon, title, subtitle = '', footer = null, children }) {
  return (
    <main className="relative min-h-screen overflow-hidden bg-[#f7f9fc] text-slate-900">
      <div
        className="pointer-events-none absolute inset-0 bg-[radial-gradient(circle_at_50%_0%,rgba(50,112,173,0.06),transparent_58%)]"
        aria-hidden="true"
      />

      <section className="relative mx-auto flex min-h-screen max-w-6xl flex-col px-5 py-6 sm:px-8 sm:py-8">
        <div className="flex items-center justify-between">
          <Link to="/" className="flex items-center" aria-label="EYLO home">
            <BrandLogo brand="eylo" size="nav" priority />
          </Link>
          <Link
            to="/discover"
            className="inline-flex items-center gap-2 rounded-lg px-3 py-2 text-xs font-medium text-slate-600 transition-colors hover:text-slate-950"
          >
            <ArrowLeft size={13} aria-hidden="true" /> Explore evidence
          </Link>
        </div>

        <div className="flex flex-1 items-center justify-center py-10">
          <div className="w-full max-w-[27rem]">
            <div className="mb-7">
              {Icon && (
                <div className="mb-5 grid h-11 w-11 place-items-center rounded-xl border border-slate-200 bg-white text-[#153c72]">
                  <Icon className="h-5 w-5" aria-hidden="true" />
                </div>
              )}

              <h1 className="font-heading text-3xl font-semibold tracking-[-0.035em] text-slate-900 sm:text-4xl">
                {title}
              </h1>
              {subtitle && <p className="mt-3 text-sm leading-6 text-slate-600">{subtitle}</p>}
            </div>

            <div className="rounded-[1.5rem] border border-slate-200/90 bg-white p-6 shadow-[0_24px_70px_-42px_rgba(15,23,42,0.30)] sm:p-8">
              {children}
            </div>

            {footer && <div className="mt-6 text-center text-sm text-slate-600">{footer}</div>}
          </div>
        </div>
      </section>
    </main>
  );
}
