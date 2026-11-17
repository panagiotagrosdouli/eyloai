import React from 'react';
import { BookOpen, Brain, Award, Rocket, Users, BarChart3, Target, FileText, AlertTriangle, Map } from 'lucide-react';
import { EYRA_MODES, EYRA_QUICK_COMMANDS } from '@/lib/eyra-next-policy.mjs';

const MODE_ICONS = { research: BookOpen, strategy: Brain, funding: Award, startup: Rocket, team: Users, impact: BarChart3 };
const COMMAND_ICONS = { project: Target, literature: FileText, gaps: AlertTriangle, funding: Award, team: Users, roadmap: Map };

export function EyraModeSelector({ activeMode, onChange, disabled = false }) {
  return (
    <div className="relative z-10 shrink-0 border-b border-border bg-background px-3 py-2">
      <div className="flex items-center gap-1.5 overflow-x-auto scrollbar-hide pb-0.5" role="group" aria-label="EYRA research lens">
        <span className="mr-1 shrink-0 whitespace-nowrap text-[9px] font-semibold uppercase tracking-widest text-muted-foreground">Lens</span>
        {EYRA_MODES.map(mode => {
          const Icon = MODE_ICONS[mode.id] || BookOpen;
          const active = activeMode === mode.id;
          return (
            <button key={mode.id} type="button" disabled={disabled} onClick={() => onChange(mode.id)}
              aria-pressed={active}
              className={`flex shrink-0 items-center gap-1.5 whitespace-nowrap rounded-lg border px-2.5 py-1.5 text-[11px] font-medium transition-colors disabled:opacity-60 ${
                active ? 'border-foreground bg-foreground text-background' : 'border-transparent text-muted-foreground hover:border-border hover:bg-secondary hover:text-foreground'
              }`}>
              <Icon size={11} aria-hidden="true" />{mode.label}
            </button>
          );
        })}
      </div>
    </div>
  );
}

export function EyraQuickCommands({ onSelect, disabled = false }) {
  return (
    <div className="relative z-10 shrink-0 border-b border-border bg-secondary/20 px-3 pb-3 pt-3">
      <p className="mb-2 px-1 text-[9px] font-semibold uppercase tracking-widest text-muted-foreground">Start with an outcome</p>
      <div className="grid grid-cols-2 gap-1.5 sm:grid-cols-3">
        {EYRA_QUICK_COMMANDS.map(command => {
          const Icon = COMMAND_ICONS[command.id] || BookOpen;
          return (
            <button key={command.id} type="button" disabled={disabled} onClick={() => onSelect(command.prompt)}
              className="group flex items-center gap-2 rounded-lg border border-border bg-card px-2.5 py-2 text-left transition-colors hover:border-primary/30 disabled:opacity-60">
              <Icon size={11} aria-hidden="true" className="shrink-0 text-muted-foreground group-hover:text-primary" />
              <span className="text-[11px] text-muted-foreground transition-colors group-hover:text-foreground">{command.label}</span>
            </button>
          );
        })}
      </div>
    </div>
  );
}
