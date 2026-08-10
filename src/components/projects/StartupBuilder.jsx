import React, { useState } from 'react';
import { base44 } from '@/api/base44Client';
import { searchAllPapers } from '@/lib/eyra-api';
import { searchFundingOpportunities } from '@/lib/funding-api';
import { Rocket, Loader2, Sparkles, ChevronDown, ChevronUp } from 'lucide-react';
import ReactMarkdown from 'react-markdown';

export default function StartupBuilder({ project }) {
  const [plan, setPlan] = useState(null);
  const [loading, setLoading] = useState(false);
  const [expanded, setExpanded] = useState(true);
  const [buildError, setBuildError] = useState('');

  const buildStartup = async () => {
    setLoading(true);
    setBuildError('');

    try {
      const searchQuery = [project.title, project.goal, project.description].filter(Boolean).join(' ');
      const [papers, fundingResult] = await Promise.all([
        searchAllPapers(searchQuery),
        searchFundingOpportunities(searchQuery, 5).catch(() => ({ items: [] })),
      ]);
      const paperContext = papers.slice(0, 8).map((paper, index) =>
        `[P${index + 1}] "${paper.title}" — ${paper.authors || 'Unknown'} (${paper.year || 'n/a'}) — ${paper.url}`
      ).join('\n');
      const fundingContext = fundingResult.items.map((item, index) =>
        `[F${index + 1}] "${item.title}" — ${item.agency} — ${item.deadline || 'deadline not supplied'} — ${item.source_url}`
      ).join('\n');

      const result = await base44.integrations.Core.InvokeLLM({
      prompt: `You are EYRA, AI Co-Founder on the EYLO platform. Convert this research project into a startup concept.

Project: ${project.title}
Goal: ${project.goal}
Description: ${project.description || 'Not provided'}

VERIFIED SCHOLARLY RECORDS:
${paperContext || 'No matching records were retrieved.'}

VERIFIED FUNDING RECORDS:
${fundingContext || 'No matching official funding records were retrieved.'}

Generate an evidence-informed startup hypothesis in markdown:

## Startup Concept
Core idea and value proposition (2-3 sentences).

## Problem & Solution
What problem does it solve and how.

## Target Market
Customer hypotheses and the exact research needed to estimate market size. Do not invent market figures.

## Business Model
How it makes money (3-4 revenue streams).

## Competitive Landscape
Categories of alternatives and differentiators. Do not invent named competitors.

## Team Requirements
Critical roles needed to launch.

## MVP Roadmap
3 phases, 4 weeks each.

## Funding Strategy
A staged funding path. Reference only supplied [F] records when naming a grant.

## Go-to-Market
First 90-day launch strategy.

## Key Risks
Top 3 risks and mitigations.

Be specific, realistic, and actionable. Reference supplied [P] and [F] records where relevant. Separate verified evidence, user assumptions, and recommendations. Never invent companies, market statistics, grants, deadlines, customers, or validation results.`,
    });
      setPlan(result);
    } catch (error) {
      setBuildError(error instanceof Error ? error.message : 'Startup analysis did not complete.');
    } finally {
      setLoading(false);
    }
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
            <p className="text-[10px] text-muted-foreground">Evidence-informed startup hypothesis from your project</p>
          </div>
        </div>
        {plan && (
          <button onClick={() => setExpanded(!expanded)} className="p-1.5 rounded-lg hover:bg-secondary transition-colors">
            {expanded ? <ChevronUp size={14} className="text-muted-foreground" /> : <ChevronDown size={14} className="text-muted-foreground" />}
          </button>
        )}
      </div>

      {buildError && (
        <div role="alert" className="mb-3 rounded-xl border border-red-500/20 bg-red-500/5 p-3 text-xs text-red-300">
          {buildError}
        </div>
      )}

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
