import React, { useState } from 'react';
import { Link } from 'react-router-dom';
import { motion } from 'framer-motion';
import {
  Check, Sparkles, Rocket, Building2, Zap, Crown, ArrowRight, Star
} from 'lucide-react';

const PLANS = [
  {
    key: 'free',
    name: 'Free',
    price: '$0',
    period: 'forever',
    tagline: 'Start your research journey',
    icon: Sparkles,
    color: 'border-border',
    highlight: false,
    features: [
      '5 EYRA discoveries per month',
      '1 active project workspace',
      'Basic research library',
      'Save papers & researchers',
      'Basic EYRA intelligence',
      'Community access',
    ],
    cta: 'Get Started Free',
    ctaClass: 'border border-border text-foreground hover:bg-secondary',
  },
  {
    key: 'pro',
    name: 'Pro',
    price: '$19',
    period: 'per month',
    tagline: 'For serious researchers & innovators',
    icon: Zap,
    color: 'border-primary/40',
    highlight: true,
    badge: 'Most Popular',
    features: [
      'Unlimited EYRA discoveries',
      'Unlimited project workspaces',
      'Project Twin (live monitoring)',
      'Funding Intelligence engine',
      'Voice EYRA assistant',
      'Advanced intelligence reports',
      'Research Battlefield access',
      'Future Simulator',
      'Impact Predictor',
      'Priority support',
    ],
    cta: 'Start Pro Trial',
    ctaClass: 'eyra-gradient text-white hover:opacity-90',
  },
  {
    key: 'founder',
    name: 'Founder',
    price: '$49',
    period: 'per month',
    tagline: 'For startup founders & deep innovators',
    icon: Rocket,
    color: 'border-accent/40',
    highlight: false,
    features: [
      'Everything in Pro',
      'Startup Builder (full plan)',
      'Grant Builder & tracker',
      'Dream Team Builder',
      'Investor Readiness Score',
      'Pitch deck AI assistance',
      'Competitor intelligence',
      'Dedicated EYRA agent',
    ],
    cta: 'Start Founder Trial',
    ctaClass: 'border border-accent/40 text-accent hover:bg-accent/10',
  },
  {
    key: 'institution',
    name: 'Institution',
    price: 'Custom',
    period: 'per seat',
    tagline: 'For universities & research centers',
    icon: Building2,
    color: 'border-border',
    highlight: false,
    features: [
      'Everything in Founder',
      'Multi-user team workspaces',
      'Admin dashboard & analytics',
      'Institution-wide library',
      'Collaboration tools',
      'Custom integrations',
      'Dedicated account manager',
      'SLA & compliance support',
    ],
    cta: 'Contact Sales',
    ctaClass: 'border border-border text-foreground hover:bg-secondary',
  },
];

const FAQS = [
  { q: 'Can I use EYLO without paying?', a: 'Yes. The Free plan gives you 5 discoveries per month, 1 project, and basic library access. No credit card required.' },
  { q: 'When will I see upgrade prompts?', a: 'Only when you try to use a premium feature. We never interrupt your research flow with paywalls.' },
  { q: 'What is a "discovery"?', a: 'A discovery is when you run an EYRA search — it finds papers, researchers, institutions, opportunities and builds a roadmap for your idea.' },
  { q: 'What is the Project Twin?', a: 'Every Pro project gets an AI twin that continuously monitors new papers, researchers, grants and trends related to your project — and alerts you automatically.' },
  { q: 'Can I cancel anytime?', a: 'Yes, no lock-in. Cancel from your profile settings at any time.' },
];

export default function Pricing() {
  const [openFaq, setOpenFaq] = useState(null);

  return (
    <div className="max-w-6xl mx-auto px-4 py-12">
      {/* Header */}
      <div className="text-center mb-12">
        <div className="inline-flex items-center gap-2 px-3 py-1.5 rounded-full border border-primary/30 bg-primary/5 mb-5">
          <Crown size={12} className="text-primary" />
          <span className="text-[10px] font-semibold tracking-widest text-primary uppercase">Transparent Pricing</span>
        </div>
        <h1 className="font-heading font-black text-3xl sm:text-5xl mb-4">
          Start free. <span className="impact-gradient">Grow with EYRA.</span>
        </h1>
        <p className="text-muted-foreground text-sm sm:text-base max-w-xl mx-auto">
          No paywalls before you understand what EYLO can do. Sign up free, explore, upgrade only when you need more power.
        </p>
      </div>

      {/* Plans grid */}
      <div className="grid gap-5 sm:grid-cols-2 lg:grid-cols-4 mb-14">
        {PLANS.map((plan, i) => {
          const Icon = plan.icon;
          return (
            <motion.div
              key={plan.key}
              initial={{ opacity: 0, y: 16 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: i * 0.06 }}
              className={`relative flex flex-col p-6 rounded-2xl border bg-card ${plan.color} ${plan.highlight ? 'ring-1 ring-primary/40' : ''}`}
            >
              {plan.badge && (
                <div className="absolute -top-3 left-1/2 -translate-x-1/2">
                  <span className="flex items-center gap-1 px-3 py-1 rounded-full eyra-gradient text-white text-[10px] font-bold uppercase tracking-wider shadow-lg">
                    <Star size={9} /> {plan.badge}
                  </span>
                </div>
              )}

              <div className="mb-4">
                <div className={`w-9 h-9 rounded-xl flex items-center justify-center mb-3 ${plan.highlight ? 'eyra-gradient' : 'bg-secondary'}`}>
                  <Icon size={16} className={plan.highlight ? 'text-white' : 'text-muted-foreground'} />
                </div>
                <h2 className="font-heading font-bold text-lg text-foreground">{plan.name}</h2>
                <p className="text-[11px] text-muted-foreground mb-3">{plan.tagline}</p>
                <div className="flex items-end gap-1.5">
                  <span className="font-black text-3xl text-foreground">{plan.price}</span>
                  {plan.period && <span className="text-xs text-muted-foreground mb-1">{plan.period}</span>}
                </div>
              </div>

              <ul className="space-y-2.5 flex-1 mb-6">
                {plan.features.map((f, j) => (
                  <li key={j} className="flex items-start gap-2 text-xs text-foreground/80">
                    <Check size={13} className={`flex-shrink-0 mt-0.5 ${plan.highlight ? 'text-primary' : 'text-green-400'}`} />
                    {f}
                  </li>
                ))}
              </ul>

              <Link
                to={plan.key === 'institution' ? '/profile' : '/register'}
                className={`flex items-center justify-center gap-2 w-full py-2.5 rounded-xl text-sm font-semibold transition-all ${plan.ctaClass}`}
              >
                {plan.cta}
                <ArrowRight size={13} />
              </Link>
            </motion.div>
          );
        })}
      </div>

      {/* Philosophy banner */}
      <div className="p-6 sm:p-8 rounded-2xl border border-primary/20 bg-primary/5 text-center mb-14">
        <Sparkles size={20} className="text-primary mx-auto mb-3" />
        <h3 className="font-heading font-bold text-lg mb-2">Our Monetization Philosophy</h3>
        <p className="text-sm text-muted-foreground max-w-2xl mx-auto leading-relaxed">
          We believe every researcher deserves to understand their idea's potential before committing. EYLO is free to explore. Upgrade prompts only appear when you genuinely need more power — never as a gate to learning.
        </p>
      </div>

      {/* FAQ */}
      <div className="max-w-2xl mx-auto">
        <h2 className="font-heading font-bold text-xl text-center mb-6">Common questions</h2>
        <div className="space-y-2">
          {FAQS.map((faq, i) => (
            <div key={i} className="border border-border rounded-xl overflow-hidden">
              <button
                onClick={() => setOpenFaq(openFaq === i ? null : i)}
                className="w-full flex items-center justify-between gap-4 px-5 py-4 text-left hover:bg-secondary/40 transition-colors"
              >
                <span className="text-sm font-medium text-foreground">{faq.q}</span>
                <span className={`text-muted-foreground flex-shrink-0 text-lg leading-none transition-transform ${openFaq === i ? 'rotate-45' : ''}`}>+</span>
              </button>
              {openFaq === i && (
                <div className="px-5 pb-4">
                  <p className="text-sm text-muted-foreground leading-relaxed">{faq.a}</p>
                </div>
              )}
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
