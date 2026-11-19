import React from 'react';
import { BookOpen, Brain, Award, Rocket, Users, BarChart3, Target, FileText, AlertTriangle, Map } from 'lucide-react';
import { EYRA_MODES, EYRA_QUICK_COMMANDS } from '@/lib/eyra-next-policy.mjs';

export const EYRA_MODE_ICONS = { research: BookOpen, strategy: Brain, funding: Award, startup: Rocket, team: Users, impact: BarChart3 };
const COMMAND_ICONS = { project: Target, literature: FileText, gaps: AlertTriangle, funding: Award, team: Users, roadmap: Map };

export function EyraModeSelector({ activeMode, onChange, disabled = false }) {
  return (
    <div className="relative z-10 shrink-0 border-b border-border/70 bg-card/70 px-4 py-3 sm:px-6">
      <div className="flex items-center gap-2 overflow-x-auto scrollbar-hide pb-0.5" role="group" aria-label="EYRA research lens">
        <span className="mr-2 shrink-0 whitespace-nowrap text-[10px] font-bold uppercase tracking-[0.16em] text-muted-foreground">Lens</span>
        {EYRA_MODES.map(mode => {
          const Icon = EYRA_MODE_ICONS[mode.id] || BookOpen;
          const active = activeMode === mode.id;
          return (
            <button key={mode.id} type="button" disabled={disabled} onClick={() => onChange(mode.id)}
              aria-pressed={active}
              className={`flex min-h-10 shrink-0 items-center gap-2 whitespace-nowrap rounded-xl border px-3.5 py-2 text-xs font-semibold transition-colors focus-visible:outline focus-visible:outline-2 focus-visible:outline-primary disabled:opacity-60 ${
                active ? 'border-primary/20 bg-primary text-primary-foreground shadow-sm' : 'border-transparent text-muted-foreground hover:border-border hover:bg-secondary hover:text-foreground'
              }`}>
              <Icon size={15} aria-hidden="true" />{mode.label}
            </button>
          );
        })}
      </div>
    </div>
  );
}

export function EyraQuickCommands({ onSelect, disabled = false }) {
  return (
    <div className="rounded-2xl border border-border/70 bg-card/80 p-4 shadow-sm sm:p-5">
      <p className="mb-3 text-[10px] font-bold uppercase tracking-[0.16em] text-muted-foreground">Start with an outcome</p>
      <div className="grid grid-cols-1 gap-2 sm:grid-cols-2 lg:grid-cols-3">
        {EYRA_QUICK_COMMANDS.map(command => {
          const Icon = COMMAND_ICONS[command.id] || BookOpen;
          return (
            <button key={command.id} type="button" disabled={disabled} onClick={() => onSelect(command.prompt)}
              className="group flex min-h-12 items-center gap-3 rounded-xl border border-border bg-background px-3.5 py-3 text-left transition-colors hover:border-primary/40 hover:bg-secondary/60 focus-visible:outline focus-visible:outline-2 focus-visible:outline-primary disabled:opacity-60">
              <Icon size={17} aria-hidden="true" className="shrink-0 text-primary" />
              <span className="text-xs font-medium text-foreground">{command.label}</span>
            </button>
          );
        })}
      </div>
    </div>
  );
}
