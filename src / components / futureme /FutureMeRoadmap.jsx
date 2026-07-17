import React, { useState } from 'react';
import { CheckCircle2, Circle, ChevronDown, ChevronUp, Target } from 'lucide-react';

const PHASE_COLORS = [
  { border: 'border-primary/40', bg: 'bg-primary/10', dot: 'bg-primary', text: 'text-primary' },
  { border: 'border-violet-400/40', bg: 'bg-violet-400/10', dot: 'bg-violet-400', text: 'text-violet-400' },
  { border: 'border-cyan-400/40', bg: 'bg-cyan-400/10', dot: 'bg-cyan-400', text: 'text-cyan-400' },
  { border: 'border-amber-400/40', bg: 'bg-amber-400/10', dot: 'bg-amber-400', text: 'text-amber-400' },
];

export default function FutureMeRoadmap({ milestones = [], goal }) {
  const [expanded, setExpanded] = useState(0);

  return (
    <div className="space-y-3">
      <p className="text-[10px] font-bold uppercase tracking-widest text-muted-foreground/60 mb-4">
        Your {goal?.timeframe} Roadmap to: <span className="text-foreground/70">{goal?.text}</span>
      </p>

      {milestones.map((m, i) => {
        const cfg = PHASE_COLORS[i % PHASE_COLORS.length];
        const isOpen = expanded === i;
        return (
          <div key={i} className={`rounded-xl border ${cfg.border} overflow-hidden`}>
            <button
              onClick={() => setExpanded(isOpen ? -1 : i)}
              className="w-full flex items-center gap-4 p-4 text-left"
            >
              {/* Phase dot + connector */}
              <div className="flex flex-col items-center gap-1 flex-shrink-0">
                <div className={`w-3 h-3 rounded-full ${cfg.dot}`} />
              </div>
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2">
                  <span className={`text-[10px] font-bold uppercase tracking-widest ${cfg.text}`}>{m.phase}</span>
                </div>
                <p className="text-sm font-semibold text-foreground mt-0.5">{m.title}</p>
              </div>
              {isOpen ? <ChevronUp size={13} className="text-muted-foreground flex-shrink-0" /> : <ChevronDown size={13} className="text-muted-foreground flex-shrink-0" />}
            </button>

            {isOpen && (
              <div className={`px-5 pb-5 ${cfg.bg}`}>
                <div className="grid sm:grid-cols-2 gap-4">
                  <div>
                    <p className="text-[10px] font-bold uppercase tracking-wider text-muted-foreground mb-2">Goals for this phase</p>
                    <div className="space-y-1.5">
                      {m.goals?.map((g, j) => (
                        <div key={j} className="flex items-start gap-2">
                          <Circle size={10} className={`${cfg.text} flex-shrink-0 mt-0.5`} />
                          <p className="text-xs text-foreground/80 leading-relaxed">{g}</p>
                        </div>
                      ))}
                    </div>
                  </div>
                  <div>
                    <p className="text-[10px] font-bold uppercase tracking-wider text-muted-foreground mb-2">Expected Outcome</p>
                    <div className={`p-3 rounded-lg border ${cfg.border} bg-background/30`}>
                      <Target size={11} className={`${cfg.text} mb-1`} />
                      <p className="text-xs text-foreground/80 leading-relaxed">{m.expected_outcome}</p>
                    </div>
                  </div>
                </div>
              </div>
            )}
          </div>
        );
      })}
    </div>
  );
}
