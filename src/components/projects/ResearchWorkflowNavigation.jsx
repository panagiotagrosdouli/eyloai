import React from 'react';
import { Check } from 'lucide-react';
import { getResearchWorkflowProgress } from '@/lib/research-workflow-progress.mjs';

export default function ResearchWorkflowNavigation({ project }) {
  const { stages, savedCount, total } = getResearchWorkflowProgress(project);
  const percent = Math.round((savedCount / total) * 100);

  return (
    <nav aria-label="Research workflow stages" className="rounded-2xl border border-border bg-card p-3 sm:p-4">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <div>
          <h2 className="text-sm font-semibold">Research workflow</h2>
          <p className="mt-0.5 text-xs text-muted-foreground">{savedCount} of {total} research drafts saved</p>
        </div>
        <div className="h-1.5 w-28 overflow-hidden rounded-full bg-secondary" role="progressbar" aria-label="Saved research draft progress" aria-valuemin={0} aria-valuemax={total} aria-valuenow={savedCount}>
          <div className="h-full rounded-full bg-primary transition-[width]" style={{ width: `${percent}%` }} />
        </div>
      </div>
      <ol className="mt-3 flex snap-x gap-2 overflow-x-auto pb-1">
        {stages.map((stage, index) => (
          <li key={stage.id} className="min-w-36 flex-1 snap-start">
            <a href={`#${stage.target}`} aria-label={`${stage.label}: ${stage.status}`} className="flex min-h-12 items-center gap-2 rounded-xl border border-border px-3 py-2 text-left transition-colors hover:bg-secondary focus-visible:outline focus-visible:outline-2 focus-visible:outline-primary">
              <span aria-hidden="true" className={`grid size-6 shrink-0 place-items-center rounded-full text-xs font-semibold ${stage.saved ? 'bg-primary text-primary-foreground' : 'bg-secondary text-muted-foreground'}`}>
                {stage.saved ? <Check size={14} /> : index + 1}
              </span>
              <span className="min-w-0">
                <span className="block text-xs font-semibold leading-4">{stage.label}</span>
                <span className="block text-[11px] leading-4 text-muted-foreground">{stage.status}</span>
              </span>
            </a>
          </li>
        ))}
      </ol>
      <p className="mt-2 text-xs leading-5 text-muted-foreground">Roadmap tasks enter the project only after researcher approval and a separate workplan save.</p>
    </nav>
  );
}
