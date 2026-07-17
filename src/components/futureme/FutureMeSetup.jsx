import React, { useState } from 'react';
import { Sparkles, Target, Rocket, BookOpen, Users, DollarSign, Award, Microscope, Code, Brain, ArrowRight, Loader2 } from 'lucide-react';
import { base44 } from '@/api/base44Client';

const GOAL_TEMPLATES = [
  { icon: Brain, label: 'AI Researcher', desc: 'Publish papers, build expertise, join labs', color: 'text-primary', bg: 'bg-primary/10 border-primary/30' },
  { icon: Rocket, label: 'Build a Startup', desc: 'Launch a tech company, raise funding', color: 'text-amber-400', bg: 'bg-amber-400/10 border-amber-400/30' },
  { icon: Award, label: 'PhD / Academic Career', desc: 'Complete doctoral research, become a professor', color: 'text-violet-400', bg: 'bg-violet-400/10 border-violet-400/30' },
  { icon: DollarSign, label: 'Win Research Funding', desc: 'Secure grants, EU Horizon, ERC, NSF', color: 'text-green-400', bg: 'bg-green-400/10 border-green-400/30' },
  { icon: Users, label: 'Build Collaborations', desc: 'Grow global research network', color: 'text-cyan-400', bg: 'bg-cyan-400/10 border-cyan-400/30' },
  { icon: BookOpen, label: 'Publish Research', desc: 'Write and publish scientific papers', color: 'text-rose-400', bg: 'bg-rose-400/10 border-rose-400/30' },
  { icon: Code, label: 'Deep Tech Product', desc: 'Build a technical product or platform', color: 'text-orange-400', bg: 'bg-orange-400/10 border-orange-400/30' },
  { icon: Microscope, label: 'Social Impact Research', desc: 'Research that solves real-world problems', color: 'text-teal-400', bg: 'bg-teal-400/10 border-teal-400/30' },
];

const TIMEFRAMES = ['1 Year', '3 Years', '5 Years', '10 Years'];

export default function FutureMeSetup({ profile, onGoalSet }) {
  const [step, setStep] = useState(1); // 1=pick template or custom, 2=refine, 3=generating
  const [selectedTemplate, setSelectedTemplate] = useState(null);
  const [customGoal, setCustomGoal] = useState('');
  const [timeframe, setTimeframe] = useState('3 Years');
  const [motivation, setMotivation] = useState('');

  const handleContinue = () => {
    if (step === 1) {
      setStep(2);
    } else {
      generate();
    }
  };

  const generate = async () => {
    setStep(3);
    const goalText = customGoal.trim() || selectedTemplate?.label || '';
    onGoalSet({
      text: goalText,
      template: selectedTemplate?.label || null,
      timeframe,
      motivation,
      set_at: new Date().toISOString(),
    });
  };

  const canContinueStep1 = selectedTemplate || customGoal.trim().length > 5;

  return (
    <div className="max-w-2xl mx-auto px-4 py-10">
      {/* Header */}
      <div className="text-center mb-10">
        <div className="w-16 h-16 rounded-2xl eyra-gradient flex items-center justify-center mx-auto mb-5 animate-pulse-glow">
          <Sparkles size={26} className="text-white" />
        </div>
        <h1 className="font-heading font-black text-3xl text-foreground mb-3">
          Meet your <span className="eyra-text-gradient">Future Me</span>
        </h1>
        <p className="text-muted-foreground text-sm max-w-sm mx-auto leading-relaxed">
          EYRA builds a personalized roadmap from who you are today to who you want to become. Let's start with your goal.
        </p>
      </div>

      {/* Step 1 — Goal Selection */}
      {step === 1 && (
        <div className="space-y-6">
          <p className="text-xs font-bold uppercase tracking-widest text-muted-foreground/60 text-center">What's your future vision?</p>

          <div className="grid grid-cols-2 gap-3">
            {GOAL_TEMPLATES.map(t => {
              const Icon = t.icon;
              const isSelected = selectedTemplate?.label === t.label;
              return (
                <button
                  key={t.label}
                  onClick={() => { setSelectedTemplate(t); setCustomGoal(''); }}
                  className={`p-4 rounded-xl border text-left transition-all ${isSelected ? t.bg : 'border-border bg-card hover:border-border/80'}`}
                >
                  <Icon size={16} className={isSelected ? t.color : 'text-muted-foreground'} />
                  <p className={`text-sm font-semibold mt-2 mb-0.5 ${isSelected ? 'text-foreground' : 'text-foreground/70'}`}>{t.label}</p>
                  <p className="text-[11px] text-muted-foreground leading-tight">{t.desc}</p>
                </button>
              );
            })}
          </div>

          <div className="relative">
            <div className="absolute inset-0 flex items-center"><div className="w-full border-t border-border/40" /></div>
            <div className="relative text-center"><span className="bg-background px-3 text-xs text-muted-foreground">or describe your own</span></div>
          </div>

          <input
            type="text"
            value={customGoal}
            onChange={e => { setCustomGoal(e.target.value); setSelectedTemplate(null); }}
            placeholder="e.g. I want to become a climate tech researcher and publish 5 papers..."
            className="w-full px-4 py-3 rounded-xl border border-border bg-secondary text-sm text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-1 focus:ring-primary/40"
          />

          <button
            onClick={handleContinue}
            disabled={!canContinueStep1}
            className="w-full flex items-center justify-center gap-2 py-3 rounded-xl eyra-gradient text-white font-semibold text-sm disabled:opacity-40"
          >
            Continue <ArrowRight size={15} />
          </button>
        </div>
      )}

      {/* Step 2 — Refine */}
      {step === 2 && (
        <div className="space-y-6">
          <div className="p-4 rounded-xl border border-primary/20 bg-primary/5 flex items-center gap-3">
            <Sparkles size={14} className="text-primary flex-shrink-0" />
            <p className="text-sm font-medium text-foreground">
              Goal: <span className="text-primary">{customGoal || selectedTemplate?.label}</span>
            </p>
          </div>

          <div>
            <p className="text-xs font-semibold uppercase tracking-wider text-muted-foreground mb-3">Your timeframe</p>
            <div className="grid grid-cols-4 gap-2">
              {TIMEFRAMES.map(t => (
                <button
                  key={t}
                  onClick={() => setTimeframe(t)}
                  className={`py-2.5 rounded-xl text-xs font-semibold border transition-all ${timeframe === t ? 'eyra-gradient text-white border-transparent' : 'border-border bg-card text-muted-foreground hover:border-primary/40'}`}
                >
                  {t}
                </button>
              ))}
            </div>
          </div>

          <div>
            <p className="text-xs font-semibold uppercase tracking-wider text-muted-foreground mb-2">Why is this goal important to you? <span className="text-muted-foreground/50 font-normal">(optional)</span></p>
            <textarea
              value={motivation}
              onChange={e => setMotivation(e.target.value)}
              placeholder="Tell EYRA what drives you. This helps personalize your roadmap..."
              rows={3}
              className="w-full px-4 py-3 rounded-xl border border-border bg-secondary text-sm text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-1 focus:ring-primary/40 resize-none"
            />
          </div>

          <div className="flex gap-3">
            <button onClick={() => setStep(1)} className="flex-1 py-3 rounded-xl border border-border text-sm font-medium text-muted-foreground hover:text-foreground transition-colors">
              Back
            </button>
            <button onClick={generate} className="flex-1 flex items-center justify-center gap-2 py-3 rounded-xl eyra-gradient text-white font-semibold text-sm">
              <Sparkles size={14} /> Build my Future Me
            </button>
          </div>
        </div>
      )}

      {step === 3 && (
        <div className="text-center py-16">
          <div className="w-14 h-14 rounded-2xl eyra-gradient flex items-center justify-center mx-auto mb-4 animate-pulse-glow">
            <Loader2 size={22} className="text-white animate-spin" />
          </div>
          <p className="text-sm font-semibold">EYRA is designing your future...</p>
          <p className="text-xs text-muted-foreground mt-1">Analyzing your profile, gaps, and opportunities</p>
        </div>
      )}
    </div>
  );
}
