import React, { useState } from 'react';
import { ArrowRight, Sparkles, ArrowLeft } from 'lucide-react';
import GuidedSearch from '@/components/discovery/GuidedSearch';

const EXAMPLES = [
  'AI for Healthcare',
  'Robotics Startup',
  'Climate Innovation',
  'Quantum Computing',
  'EdTech Platform',
];

function EyloSymbol({ size = 24 }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none">
      <defs>
        <linearGradient id="eylo-grad" x1="0%" y1="0%" x2="100%" y2="100%">
          <stop offset="0%" stopColor="hsl(199,100%,65%)" />
          <stop offset="100%" stopColor="hsl(252,85%,75%)" />
        </linearGradient>
        <filter id="glow-sm">
          <feGaussianBlur stdDeviation="0.8" result="blur" />
          <feMerge><feMergeNode in="blur" /><feMergeNode in="SourceGraphic" /></feMerge>
        </filter>
      </defs>
      <path d="M12 14L5 4" stroke="url(#eylo-grad)" strokeWidth="2.2" strokeLinecap="round" filter="url(#glow-sm)" />
      <path d="M12 14L19 4" stroke="url(#eylo-grad)" strokeWidth="2.2" strokeLinecap="round" filter="url(#glow-sm)" />
      <path d="M12 14V21" stroke="url(#eylo-grad)" strokeWidth="2.2" strokeLinecap="round" filter="url(#glow-sm)" />
    </svg>
  );
}

// Compact bar shown above results
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
  const [query, setQuery] = useState('');

  const handleSubmit = (e) => {
    e.preventDefault();
    if (query.trim()) onSearch(query.trim());
  };

  return null; // Dashboard is now the default view — this component is not used standalone
}
