import React from 'react';

export default function AuthLayout({ icon: Icon, title, subtitle, footer, children }) {
  return (
    <main className="relative min-h-screen overflow-hidden bg-[#020714] px-4 py-8 text-white sm:px-6 lg:grid lg:grid-cols-[minmax(0,1.05fr)_minmax(420px,0.95fr)] lg:items-stretch lg:p-0">
      <div className="pointer-events-none absolute inset-0 bg-[radial-gradient(circle_at_20%_20%,rgba(0,196,255,0.12),transparent_34%),radial-gradient(circle_at_78%_82%,rgba(25,92,255,0.12),transparent_32%)]" />

      <section className="relative hidden min-h-screen items-center justify-center overflow-hidden border-r border-white/10 lg:flex">
        <img
          src="/brand/eylo-logo.svg"
          alt="EYLO"
          className="h-full w-full object-contain object-center p-12 opacity-100 drop-shadow-[0_30px_90px_rgba(0,196,255,0.25)]"
        />
        <div className="absolute inset-x-0 bottom-0 bg-gradient-to-t from-[#020714] via-[#020714]/60 to-transparent px-12 pb-12 pt-32">
          <p className="text-xs font-semibold uppercase tracking-[0.32em] text-cyan-300">Research & Innovation OS</p>
          <p className="mt-3 max-w-xl text-lg leading-7 text-white/75">Turn one idea into evidence, collaborators, funding opportunities and measurable impact.</p>
        </div>
      </section>

      <div className="relative flex min-h-[calc(100vh-4rem)] items-center justify-center lg:min-h-screen lg:px-10">
        <section className="w-full max-w-md rounded-3xl border border-white/10 bg-[#07101f]/90 p-7 shadow-[0_30px_100px_-30px_rgba(0,174,255,0.45)] backdrop-blur-xl sm:p-9">
          <div className="mb-8 text-center">
            <a href="/" aria-label="EYLO home" className="mx-auto mb-6 block w-fit">
              <img src="/brand/eylo-logo.svg" alt="EYLO" className="h-20 w-auto max-w-[280px] object-contain drop-shadow-[0_12px_32px_rgba(0,196,255,0.28)]" />
            </a>
            {Icon && (
              <div className="mx-auto mb-4 flex h-11 w-11 items-center justify-center rounded-xl border border-cyan-300/20 bg-cyan-400/10 text-cyan-300">
                <Icon className="h-6 w-6" aria-hidden="true" />
              </div>
            )}
            <h1 className="text-2xl font-bold text-white">{title}</h1>
            {subtitle && <p className="mt-2 text-sm text-white/55">{subtitle}</p>}
          </div>

          {children}

          {footer && <div className="mt-6 text-center text-sm text-white/55">{footer}</div>}
        </section>
      </div>
    </main>
  );
}
