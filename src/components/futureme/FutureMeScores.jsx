import React from 'react';
import { Brain, BookOpen, Users, DollarSign, Zap, Star } from 'lucide-react';

const SCORE_CONFIG = [
  { key: 'learning', label: 'Learning', icon: BookOpen, color: 'text-blue-400', bar: 'bg-blue-400' },
  { key: 'research', label: 'Research', icon: Brain, color: 'text-primary', bar: 'bg-primary' },
  { key: 'collaboration', label: 'Collaboration', icon: Users, color: 'text-cyan-400', bar: 'bg-cyan-400' },
  { key: 'funding', label: 'Funding', icon: DollarSign, color: 'text-green-400', bar: 'bg-green-400' },
  { key: 'innovation', label: 'Innovation', icon: Zap, color: 'text-amber-400', bar: 'bg-amber-400' },
  { key: 'leadership', label: 'Leadership', icon: Star, color: 'text-violet-400', bar: 'bg-violet-400' },
];

export default function FutureMeScores({ scores = {}, labels = {}, overallProgress = 0 }) {
  return (
    <div>
      {/* Overall */}
      <div className="p-5 rounded-2xl border border-border bg-card mb-4">
        <div className="flex items-center justify-between mb-3">
          <div>
            <p className="text-[10px] font-bold uppercase tracking-widest text-muted-foreground/60 mb-0.5">Future Goal Progress</p>
            <p className="text-xs text-muted-foreground">Based on your current profile vs. your target</p>
          </div>
          <p className="text-4xl font-black eyra-text-gradient">{overallProgress}%</p>
        </div>
        <div className="h-2.5 rounded-full bg-secondary overflow-hidden">
          <div
            className="h-full rounded-full eyra-gradient transition-all duration-1000"
            style={{ width: `${overallProgress}%` }}
          />
        </div>
      </div>

      {/* Individual scores */}
      <div className="grid sm:grid-cols-2 gap-3">
        {SCORE_CONFIG.map(cfg => {
          const Icon = cfg.icon;
          const val = scores[cfg.key] || 0;
          const label = labels[cfg.key] || '';
          return (
            <div key={cfg.key} className="p-4 rounded-xl border border-border bg-card">
              <div className="flex items-center justify-between mb-2">
                <div className="flex items-center gap-2">
                  <Icon size={13} className={cfg.color} />
                  <span className="text-xs font-semibold text-foreground">{cfg.label}</span>
                </div>
                <span className={`text-sm font-black ${cfg.color}`}>{val}</span>
              </div>
              <div className="h-1 rounded-full bg-secondary overflow-hidden mb-2">
                <div className={`h-full rounded-full ${cfg.bar} transition-all duration-700`} style={{ width: `${val}%` }} />
              </div>
              {label && <p className="text-[10px] text-muted-foreground leading-relaxed">{label}</p>}
            </div>
          );
        })}
      </div>
    </div>
  );
}
