import React from 'react';
import { AlertTriangle, ArrowRight, CheckCircle2 } from 'lucide-react';

const PRIORITY_STYLE = {
  high: { border: 'border-rose-400/30', bg: 'bg-rose-400/5', badge: 'bg-rose-400/10 text-rose-400', dot: 'bg-rose-400' },
  medium: { border: 'border-amber-400/30', bg: 'bg-amber-400/5', badge: 'bg-amber-400/10 text-amber-400', dot: 'bg-amber-400' },
  low: { border: 'border-green-400/30', bg: 'bg-green-400/5', badge: 'bg-green-400/10 text-green-400', dot: 'bg-green-400' },
};

export default function FutureMeGapAnalysis({ gaps = [], overallProgress = 0 }) {
  const targetProgress = 90;

  return (
    <div className="space-y-4">
      {/* Summary bar */}
      <div className="p-5 rounded-2xl border border-border bg-card">
        <div className="flex items-center justify-between mb-4">
          <p className="text-[10px] font-bold uppercase tracking-widest text-muted-foreground/60">Gap Summary</p>
          <span className="text-xs text-muted-foreground">Target: 90% readiness</span>
        </div>
        <div className="grid grid-cols-2 gap-3">
          <div>
            <p className="text-xs text-muted-foreground mb-1">Current Position</p>
            <div className="flex items-center gap-2">
              <div className="flex-1 h-2 rounded-full bg-secondary overflow-hidden">
                <div className="h-full rounded-full bg-muted-foreground/50" style={{ width: `${overallProgress}%` }} />
              </div>
              <span className="text-xs font-bold">{overallProgress}%</span>
            </div>
          </div>
          <div>
            <p className="text-xs text-muted-foreground mb-1">Target Position</p>
            <div className="flex items-center gap-2">
              <div className="flex-1 h-2 rounded-full bg-secondary overflow-hidden">
                <div className="h-full rounded-full eyra-gradient" style={{ width: `${targetProgress}%` }} />
              </div>
              <span className="text-xs font-bold text-primary">{targetProgress}%</span>
            </div>
          </div>
        </div>
        <div className="mt-3 pt-3 border-t border-border/40">
          <p className="text-xs text-muted-foreground">
            <span className="text-amber-400 font-semibold">{targetProgress - overallProgress}%</span> gap to close — focus on the high-priority areas below.
          </p>
        </div>
      </div>

      {/* Gaps */}
      {gaps.map((gap, i) => {
        const style = PRIORITY_STYLE[gap.priority] || PRIORITY_STYLE.medium;
        return (
          <div key={i} className={`p-4 rounded-xl border ${style.border} ${style.bg}`}>
            <div className="flex items-start justify-between gap-3 mb-3">
              <div>
                <div className="flex items-center gap-2 mb-1">
                  <div className={`w-2 h-2 rounded-full flex-shrink-0 ${style.dot}`} />
                  <p className="text-sm font-semibold text-foreground">{gap.area}</p>
                  <span className={`text-[9px] px-1.5 py-0.5 rounded font-bold uppercase ${style.badge}`}>{gap.priority}</span>
                </div>
              </div>
            </div>
            <div className="grid sm:grid-cols-2 gap-3 mb-3">
              <div className="p-2.5 rounded-lg bg-background/30 border border-white/5">
                <p className="text-[9px] font-bold uppercase tracking-wider text-muted-foreground mb-1">Current State</p>
                <p className="text-xs text-foreground/70">{gap.current}</p>
              </div>
              <div className="p-2.5 rounded-lg bg-background/30 border border-white/5">
                <p className="text-[9px] font-bold uppercase tracking-wider text-muted-foreground mb-1">Target State</p>
                <p className="text-xs text-foreground/70">{gap.target}</p>
              </div>
            </div>
            {gap.actions?.length > 0 && (
              <div>
                <p className="text-[9px] font-bold uppercase tracking-wider text-muted-foreground mb-1.5">Actions to Close Gap</p>
                <div className="space-y-1">
                  {gap.actions.map((a, j) => (
                    <div key={j} className="flex items-start gap-2">
                      <ArrowRight size={10} className="text-primary flex-shrink-0 mt-0.5" />
                      <p className="text-xs text-foreground/80">{a}</p>
                    </div>
                  ))}
                </div>
              </div>
            )}
          </div>
        );
      })}
    </div>
  );
}
