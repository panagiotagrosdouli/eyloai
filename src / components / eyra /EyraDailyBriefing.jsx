import React, { useState, useEffect } from 'react';
import { base44 } from '@/api/base44Client';
import ReactMarkdown from 'react-markdown';
import { Sparkles, Loader2, ChevronDown, ChevronUp, X, RefreshCw } from 'lucide-react';

const CACHE_DATE_KEY = 'eyra_briefing_date';
const CACHE_CONTENT_KEY = 'eyra_briefing_cache';

export default function EyraDailyBriefing({ stats, recentSearches, projects }) {
  const [briefing, setBriefing] = useState(null);
  const [loading, setLoading] = useState(false);
  const [expanded, setExpanded] = useState(true);
  const [dismissed, setDismissed] = useState(false);

  useEffect(() => {
    const today = new Date().toDateString();
    const cachedDate = localStorage.getItem(CACHE_DATE_KEY);
    const cachedContent = localStorage.getItem(CACHE_CONTENT_KEY);
    if (cachedDate === today && cachedContent) {
      setBriefing(cachedContent);
    } else {
      generateBriefing(today);
    }
  }, []);

  const generateBriefing = async (today = new Date().toDateString()) => {
    setLoading(true);
    const projectList = projects.slice(0, 3).map(p => `- ${p.title} (${p.status || 'planning'}): ${p.goal}`).join('\n') || 'No active projects yet.';
    const searches = recentSearches.slice(0, 3).map(s => `- ${s.query}`).join('\n') || 'No recent searches.';
    const date = new Date().toLocaleDateString('en-US', { weekday: 'long', month: 'long', day: 'numeric' });

    const result = await base44.integrations.Core.InvokeLLM({
      prompt: `You are EYRA — AI Research Co-Founder on the EYLO platform. Generate a concise morning briefing.

Date: ${date}
Projects:\n${projectList}
Recent Searches:\n${searches}
Library: ${stats.papers} papers, ${stats.researchers} researchers, ${stats.opportunities} opportunities

Write a SHORT professional briefing (max 150 words) in markdown:

## Good ${new Date().getHours() < 12 ? 'morning' : new Date().getHours() < 17 ? 'afternoon' : 'evening'}.

**Today's Priority**
One specific action to take today based on their project context.

**Recommended Actions**
3 bullet points — concrete and specific.

**Intelligence Alert**
One strategic insight relevant to their research areas.

Sound like a trusted co-founder. Be direct and specific. No fluff.`,
    });

    setBriefing(result);
    localStorage.setItem(CACHE_DATE_KEY, today);
    localStorage.setItem(CACHE_CONTENT_KEY, result);
    setLoading(false);
  };

  const refresh = () => {
    localStorage.removeItem(CACHE_DATE_KEY);
    localStorage.removeItem(CACHE_CONTENT_KEY);
    generateBriefing();
  };

  if (dismissed) return null;

  return (
    <div className="rounded-2xl border border-border bg-card overflow-hidden">
      {/* Header */}
      <div className="flex items-center gap-3 px-5 py-3.5 border-b border-border/50">
        <div className="w-7 h-7 rounded-lg overflow-hidden bg-white flex items-center justify-center flex-shrink-0">
          <img src="https://media.base44.com/images/public/6a3b660e73254d1b4bf55bcb/33f475246_image.png" alt="EYRA" className="w-full h-full object-contain" />
        </div>
        <div className="flex-1">
          <div className="flex items-center gap-2">
            <span className="text-xs font-semibold text-foreground">EYRA Daily Briefing</span>
            <span className="text-[10px] px-2 py-0.5 rounded-full bg-green-500/10 text-green-400 font-medium">
              {new Date().toLocaleDateString('en-US', { weekday: 'short', month: 'short', day: 'numeric' })}
            </span>
          </div>
          <p className="text-[10px] text-muted-foreground">Personalized intelligence from your AI co-founder</p>
        </div>
        <div className="flex items-center gap-1">
          <button onClick={refresh} disabled={loading}
            className="p-1.5 rounded-lg hover:bg-secondary text-muted-foreground transition-colors" title="Refresh">
            {loading ? <Loader2 size={12} className="animate-spin text-primary" /> : <RefreshCw size={12} />}
          </button>
          <button onClick={() => setExpanded(!expanded)}
            className="p-1.5 rounded-lg hover:bg-secondary text-muted-foreground transition-colors">
            {expanded ? <ChevronUp size={12} /> : <ChevronDown size={12} />}
          </button>
          <button onClick={() => setDismissed(true)}
            className="p-1.5 rounded-lg hover:bg-secondary text-muted-foreground transition-colors">
            <X size={12} />
          </button>
        </div>
      </div>

      {/* Body */}
      {expanded && (
        <div className="px-5 py-4">
          {loading && (
            <div className="flex items-center gap-3 py-2">
              <div className="flex gap-1">
                {[0, 1, 2].map(i => (
                  <div key={i} className="w-1.5 h-1.5 rounded-full bg-primary animate-bounce" style={{ animationDelay: `${i * 0.15}s` }} />
                ))}
              </div>
              <span className="text-xs text-muted-foreground">EYRA is preparing your briefing...</span>
            </div>
          )}
          {briefing && !loading && (
            <div className="prose prose-sm max-w-none prose-headings:text-foreground prose-headings:font-semibold prose-headings:text-sm prose-p:text-foreground/80 prose-li:text-foreground/80 prose-strong:text-primary prose-p:my-1 prose-ul:my-1 prose-headings:mt-3 prose-headings:mb-1.5 text-sm leading-relaxed">
              <ReactMarkdown>{briefing}</ReactMarkdown>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
