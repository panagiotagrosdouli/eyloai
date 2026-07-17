import React, { useState, useEffect } from 'react';
import { Sparkles, FileText, Users, Building2, Brain, CheckCircle2, Loader2 } from 'lucide-react';

const SOURCES = [
  { id: 'papers', label: 'Searching papers', sublabel: 'OpenAlex · arXiv · Europe PMC', icon: FileText, key: 'papersLoaded' },
  { id: 'researchers', label: 'Finding researchers', sublabel: 'OpenAlex profiles', icon: Users, key: 'researchersLoaded' },
  { id: 'institutions', label: 'Scanning institutions', sublabel: 'OpenAlex database', icon: Building2, key: 'institutionsLoaded' },
  { id: 'ai', label: 'EYRA analyzing data', sublabel: 'Evidence-based intelligence', icon: Brain, key: null },
];

export default function LoadingState({ query, progress }) {
  const isAnalyzing = progress?.status === 'analyzing';
  const isComplete = progress?.status === 'complete';

  const papersCount = progress?.papers?.length || 0;
  const researchersCount = progress?.researchers?.length || 0;
  const institutionsCount = progress?.institutions?.length || 0;

  return (
    <div className="min-h-[calc(100vh-56px)] flex flex-col items-center justify-center px-4 py-16">
      {/* Orb */}
      <div className="relative mb-8 flex items-center justify-center" style={{ width: 80, height: 80 }}>
        <div className="absolute inset-0 rounded-full eyra-orb animate-spin-slow opacity-60" style={{ padding: '3px' }}>
          <div className="w-full h-full rounded-full bg-background" />
        </div>
        <div className="absolute inset-4 rounded-full eyra-gradient animate-pulse-glow" />
        <Sparkles size={16} className="relative z-10 text-white" />
      </div>

      <p className="text-[10px] font-bold tracking-widest uppercase text-primary mb-1">EYRA Intelligence</p>
      <h2 className="font-heading font-bold text-xl text-foreground mb-1 text-center">
        {isAnalyzing ? 'Analyzing real data...' : isComplete ? 'Report ready' : 'Searching databases...'}
      </h2>
      <p className="text-muted-foreground text-sm mb-8 text-center">
        "<span className="text-foreground font-medium">{query}</span>"
      </p>

      {/* Live source status */}
      <div className="w-full max-w-sm space-y-2">
        {SOURCES.map(src => {
          const Icon = src.icon;
          const isAi = src.id === 'ai';
          const done = isAi ? isAnalyzing || isComplete : progress?.[src.key];
          const active = isAi ? isAnalyzing : !done;
          const count = src.id === 'papers' ? papersCount : src.id === 'researchers' ? researchersCount : src.id === 'institutions' ? institutionsCount : null;

          return (
            <div key={src.id} className={`flex items-center gap-3 px-4 py-3 rounded-xl border transition-all duration-500 ${
              done ? 'border-primary/20 bg-primary/5' : 'border-border/40 bg-card'
            }`}>
              <div className={`w-7 h-7 rounded-lg flex items-center justify-center flex-shrink-0 ${done ? 'bg-primary/10' : 'bg-secondary'}`}>
                <Icon size={13} className={done ? 'text-primary' : 'text-muted-foreground'} />
              </div>
              <div className="flex-1 min-w-0">
                <p className={`text-sm font-medium ${done ? 'text-foreground' : 'text-muted-foreground'}`}>{src.label}</p>
                <p className="text-[10px] text-muted-foreground">{src.sublabel}</p>
              </div>
              <div className="flex-shrink-0">
                {done ? (
                  count !== null ? (
                    <span className="text-xs font-bold text-primary">{count} found</span>
                  ) : (
                    <CheckCircle2 size={14} className="text-primary" />
                  )
                ) : (
                  <Loader2 size={13} className="text-muted-foreground/40 animate-spin" />
                )}
              </div>
            </div>
          );
        })}
      </div>

      {/* Live counts summary */}
      {(papersCount > 0 || researchersCount > 0) && (
        <div className="mt-6 flex items-center gap-4 text-xs text-muted-foreground">
          {papersCount > 0 && <span className="text-primary font-semibold">{papersCount} papers</span>}
          {researchersCount > 0 && <span className="text-primary font-semibold">{researchersCount} researchers</span>}
          {institutionsCount > 0 && <span className="text-primary font-semibold">{institutionsCount} institutions</span>}
          <span>found so far</span>
        </div>
      )}
    </div>
  );
}
