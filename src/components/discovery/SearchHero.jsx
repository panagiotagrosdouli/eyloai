import React from 'react';
import { ArrowLeft } from 'lucide-react';
import GuidedSearch from '@/components/discovery/GuidedSearch';

export function SearchHeroCompact({ onSearch, currentQuery, onBack }) {
  return (
    <div className="sticky top-14 z-40 border-b border-border/60 bg-background/92 px-4 py-3 backdrop-blur-xl">
      <div className="mx-auto flex max-w-5xl items-start gap-2">
        <button type="button" onClick={onBack} aria-label="Back to dashboard" className="mt-1.5 shrink-0 rounded-xl p-3 text-muted-foreground transition-colors hover:bg-secondary hover:text-foreground">
          <ArrowLeft size={16} />
        </button>
        <div className="min-w-0 flex-1">
          <GuidedSearch key={currentQuery} onSearch={onSearch} initialTopic={currentQuery} compact />
        </div>
      </div>
    </div>
  );
}

export default function SearchHero({ onSearch }) {
  return <GuidedSearch onSearch={onSearch} />;
}
