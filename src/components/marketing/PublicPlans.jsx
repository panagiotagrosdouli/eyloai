import { Link } from "react-router-dom";
import { Check, ArrowRight, Sparkles } from "lucide-react";
import { PLAN_CATALOG } from "@/lib/plan-catalog";
import PublicHeader from "./PublicHeader";

export default function PublicPlans({ standalone = false }) {
  const Heading = standalone ? "h1" : "h2";
  const section = (
    <section
      id="premium"
      aria-labelledby="premium-title"
      className="scroll-mt-24 px-5 py-20 sm:px-9 sm:py-24 lg:px-16"
    >
      <div className="mx-auto max-w-[1350px]">
        <div className="max-w-2xl">
          <p className="text-[11px] font-semibold uppercase tracking-[.18em] text-[var(--company-muted)]">
            Plans & Premium
          </p>
          <Heading
            id="premium-title"
            className="mt-4 text-[clamp(2.2rem,4vw,3.8rem)] font-bold leading-[1.12] tracking-[-.055em]"
          >
            Start with curiosity.
            <br />
            Choose room to grow.
          </Heading>
          <p className="mt-5 text-base leading-7 text-[var(--company-muted)]">
            Explore public research freely. Create your workspace when you’re
            ready, and see the planned options for deeper work.
          </p>
        </div>
        <p
          role="note"
          className="mt-8 rounded-xl border border-[var(--company-border)] bg-[var(--company-soft)] px-5 py-4 text-sm leading-6 text-[var(--company-muted)]"
        >
          Early access: the paid plans and prices below are planned. Paid
          subscriptions are not available yet. No payment is collected here.
        </p>
        <div className="mt-8 grid gap-5 sm:grid-cols-2 xl:grid-cols-4">
          {PLAN_CATALOG.map((plan) => (
            <article
              key={plan.key}
              className={`flex flex-col rounded-2xl border bg-[var(--company-surface)] p-6 ${plan.featured ? "border-[#24AAF3] ring-1 ring-[#24AAF3]" : "border-[var(--company-border)]"}`}
            >
              <div className="flex items-center justify-between gap-2">
                <h3 className="text-xl font-semibold">{plan.name}</h3>
                {plan.featured && (
                  <span className="inline-flex items-center gap-1 rounded-full bg-[var(--company-tint)] px-2.5 py-1 text-[10px] font-semibold text-[var(--company-ink)]">
                    <Sparkles size={12} aria-hidden="true" />
                    Premium
                  </span>
                )}
              </div>
              <p className="mt-5 text-4xl font-bold tracking-tight">
                {plan.price}
              </p>
              <p className="mt-2 text-xs text-[var(--company-muted)]">
                {plan.period}
                {plan.key !== "free" ? " · planned" : ""}
              </p>
              <ul className="my-7 flex-1 space-y-3">
                {plan.features.slice(0, 4).map((feature) => (
                  <li
                    key={feature}
                    className="flex items-start gap-2 text-sm leading-6 text-[var(--company-muted)]"
                  >
                    <Check
                      size={16}
                      className="mt-1 shrink-0"
                      aria-hidden="true"
                    />
                    {feature}
                  </li>
                ))}
              </ul>
              <Link
                to={plan.key === "free" ? "/register" : "/contact"}
                className={`inline-flex min-h-12 items-center justify-center gap-2 rounded-xl px-4 text-sm font-semibold ${plan.key === "free" ? "company-primary" : "border border-[var(--company-border)] hover:bg-[var(--company-soft)]"}`}
              >
                {plan.key === "free"
                  ? "Start with Free"
                  : `Ask about ${plan.name}`}
                <ArrowRight size={15} aria-hidden="true" />
              </Link>
            </article>
          ))}
        </div>
        <p className="mt-6 max-w-3xl text-xs leading-6 text-[var(--company-muted)]">
          Prices are shown in USD. Paid features remain subject to availability,
          usage limits and final plan terms. Availability of individual tools
          varies during early access.
        </p>
      </div>
    </section>
  );
  return standalone ? (
    <div className="eylo-company min-h-screen bg-[var(--company-surface)] text-[var(--company-ink)]">
      <PublicHeader />
      <main>{section}</main>
      <footer className="border-t border-[var(--company-border)] px-5 py-8 text-center text-sm">
        <Link to="/">Back to EYLO</Link>
      </footer>
    </div>
  ) : (
    section
  );
}
