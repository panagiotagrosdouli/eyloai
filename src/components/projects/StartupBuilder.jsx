import React, { useState } from 'react';
import { base44 } from '@/api/base44Client';
import { Rocket, Loader2, Sparkles, ChevronDown, ChevronUp } from 'lucide-react';
import ReactMarkdown from 'react-markdown';

export default function StartupBuilder({ project }) {
  const [plan, setPlan] = useState(null);
  const [loading, setLoading] = useState(false);
  const [expanded, setExpanded] = useState(true);

  const buildStartup = async () => {
    setLoading(true);
    const result = await base44.integrations.Core.InvokeLLM({
      prompt: `You are EYRA, AI Co-Founder on the EYLO platform. Convert this research project into a startup concept.

Project: ${project.title}
Goal: ${project.goal}
Description: ${project.description || 'Not provided'}

Generate a full startup plan in markdown:

## Startup Concept
Core idea and value proposition (2-3 sentences).

## Problem & Solution
What problem does it solve and how.

## Target Market
Primary customer segments and market size.

## Business Model
How it makes money (3-4 revenue streams).

## Competitive Landscape
3-4 competitors and your key differentiators.

## Team Requirements
Critical roles needed to launch.

## MVP Roadmap
3 phases, 4 weeks each.

## Funding Strategy
Recommended funding path (bootstrap, grants, angels, VC).

## Go-to-Market
First 90-day launch strategy.

## Key Risks
Top 3 risks and mitigations.

Be specific, realistic, and actionable. Think like a seasoned startup advisor.`,
    });
    setPlan(result);
    setLoading(false);
  };

  return (
    <div className="p-5 rounded-2xl border border-green-500/20 bg-green-500/5">
      <div className="flex items-center justify-between mb-3">
        <div className="flex items-center gap-3">
          <div className="w-9 h-9 rounded-xl bg-green-500/15 border border-green-500/20 flex items-center justify-center">
            <Rocket size={15} className="text-green-400" />
          </div>
          <div>
            <p className="text-sm font-bold text-foreground">Startup Builder</p>
            <p className="text-[10px] text-muted-foreground">EYRA converts your project into a startup plan</p>
          </div>
        </div>
        {plan && (
          <button onClick={() => setExpanded(!expanded)} className="p-1.5 rounded-lg hover:bg-secondary transition-colors">
            {expanded ? <ChevronUp size={14} className="text-muted-foreground" /> : <ChevronDown size={14} className="text-muted-foreground" />}
          </button>
        )}
      </div>

      {!plan && !loading && (
        <button
          onClick={buildStartup}
          className="w-full flex items-center justify-center gap-2 py-3 rounded-xl bg-green-500/15 border border-green-500/25 text-green-400 text-sm font-semibold hover:bg-green-500/20 transition-colors"
        >
          <Sparkles size={14} />
          Convert to Startup
        </button>
      )}

      {loading && (
        <div className="flex flex-col items-center py-8">
          <Loader2 size={20} className="text-green-400 animate-spin mb-2" />
          <p className="text-xs text-muted-foreground">EYRA is building your startup plan...</p>
        </div>
      )}

      {plan && expanded && (
        <div className="mt-3 prose prose-sm max-w-none text-sm prose-headings:text-foreground prose-headings:font-semibold prose-p:text-muted-foreground prose-li:text-muted-foreground prose-strong:text-foreground prose-headings:text-sm">
          <ReactMarkdown>{plan}</ReactMarkdown>
        </div>
      )}

      {plan && !loading && (
        <button
          onClick={buildStartup}
          className="mt-3 text-[10px] text-green-400 hover:underline flex items-center gap-1"
        >
          <Sparkles size={10} /> Regenerate plan
        </button>
      )}
    </div>
  );
}
