import React, { useState } from 'react';
import { base44 } from '@/api/base44Client';
import { Sparkles, Loader2, ChevronDown, ChevronUp, BookOpen } from 'lucide-react';
import ReactMarkdown from 'react-markdown';

/**
 * Inline research companion — given a paper title + context, suggests:
 * related work, researchers, follow-up questions, and future directions.
 */
export default function EyraResearchCompanion({ paper, userInterests }) {
  const [open, setOpen] = useState(false);
  const [insight, setInsight] = useState(null);
  const [loading, setLoading] = useState(false);

  const generate = async () => {
    if (insight) { setOpen(!open); return; }
    setLoading(true);
    setOpen(true);
    const result = await base44.integrations.Core.InvokeLLM({
      prompt: `You are EYRA Research Companion. Given this paper, provide a brief structured companion guide.

Paper: "${paper.title}"
Authors: ${paper.authors || 'Unknown'}
Year: ${paper.year || 'Unknown'}
User Interests: ${userInterests || 'research and innovation'}

Respond in markdown (max 180 words total):

## Related Directions
2-3 research angles to explore next (not specific paper titles — search terms and themes)

## Questions to Consider
2 open research questions this paper raises

## Who to Find
What type of researcher or lab expertise to look for next

Keep it brief, specific, and actionable. Do not invent paper titles or researcher names.`,
    });
    setInsight(result);
    setLoading(false);
  };

  return (
    <div className="mt-3 border-t border-border/40 pt-3">
      <button
        onClick={generate}
        className="flex items-center gap-1.5 text-[11px] font-medium text-primary hover:underline"
      >
        {loading ? <Loader2 size={10} className="animate-spin" /> : <BookOpen size={10} />}
        {loading ? 'EYRA thinking...' : 'EYRA Research Companion'}
        {!loading && insight && (open ? <ChevronUp size={10} /> : <ChevronDown size={10} />)}
      </button>
      {open && !loading && insight && (
        <div className="mt-2 p-3 rounded-xl bg-primary/5 border border-primary/15">
          <div className="prose prose-sm max-w-none prose-headings:text-xs prose-headings:font-semibold prose-headings:text-primary prose-headings:mb-1 prose-headings:mt-2 prose-p:text-muted-foreground prose-li:text-muted-foreground prose-p:my-0.5 prose-ul:my-0.5 text-xs">
            <ReactMarkdown>{insight}</ReactMarkdown>
          </div>
        </div>
      )}
    </div>
  );
}
