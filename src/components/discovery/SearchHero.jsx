import React, { useState } from 'react';
import { ArrowRight, Sparkles, ArrowLeft, X } from 'lucide-react';

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
  const [query, setQuery] = useState(currentQuery || '');

  const handleSubmit = (e) => {
    e.preventDefault();
    if (query.trim()) onSearch(query.trim());
  };

  return (
    <div className="sticky top-14 z-40 border-b border-border/60 bg-background/90 backdrop-blur-xl px-4 py-3">
      <form onSubmit={handleSubmit} className="max-w-4xl mx-auto flex items-center gap-3">
        <button type="button" onClick={onBack} className="p-2 rounded-lg text-muted-foreground hover:text-foreground hover:bg-secondary transition-colors flex-shrink-0">
          <ArrowLeft size={16} />
        </button>
        <div className="flex-1 relative">
          <Sparkles size={14} className="absolute left-3.5 top-1/2 -translate-y-1/2 text-primary" />
          <input
            type="text"
            value={query}
            onChange={e => setQuery(e.target.value)}
            placeholder="Ask EYRA anything..."
            className="w-full h-10 pl-9 pr-28 rounded-xl border border-border bg-secondary text-sm text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-1 focus:ring-primary/40 focus:border-primary/40 transition-all"
          />
          {query && (
            <button type="button" onClick={() => setQuery('')} className="absolute right-24 top-1/2 -translate-y-1/2 p-1 text-muted-foreground hover:text-foreground">
              <X size={12} />
            </button>
          )}
          <button
            type="submit"
            disabled={!query.trim()}
            className="absolute right-1.5 top-1/2 -translate-y-1/2 px-4 py-1.5 rounded-lg eyra-gradient text-white text-xs font-semibold disabled:opacity-40 transition-opacity flex items-center gap-1.5"
          >
            <Sparkles size={11} />
            Discover
          </button>
        </div>
      </form>
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
