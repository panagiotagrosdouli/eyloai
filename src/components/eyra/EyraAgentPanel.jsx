import React, { useEffect, useRef, useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { base44 } from '@/api/base44Client';
import { searchAllPapersWithStatus } from '@/lib/eyra-api';
import { searchFundingOpportunities } from '@/lib/funding-api';
import { buildEyraAgentEvidence, buildEyraAgentPrompt, eyraAgentFailureMessage } from '@/lib/eyra-agent-evidence.mjs';
import ReactMarkdown from 'react-markdown';
import {
  X, Sparkles, Loader2, FileText, Users, Award, Rocket,
  Brain, RefreshCw, Search, ExternalLink, AlertCircle
} from 'lucide-react';

const AGENTS = [
  {
    key: 'research',
    label: 'Research Agent',
    icon: Search,
    color: 'text-primary',
    bg: 'bg-primary/10 border-primary/25',
    activeBg: 'bg-primary/15 border-primary/40',
    description: 'Retrieves real publications and drafts a source-linked research overview; gaps remain hypotheses',
    placeholder: 'e.g. AI for early cancer detection, quantum computing in cryptography...',
    prompt: (q) => `You are EYRA Research Agent — an autonomous research intelligence system.

The user wants to research: "${q}"

Perform a full research intelligence sweep. Output in markdown:

## 🔬 Research Intelligence Report
Brief executive summary (2-3 sentences on the field's state).

## 📄 Key Papers & Findings
5-7 most important research directions and landmark findings in this area (be specific with paper concepts, not made-up citations).

## 👥 Leading Researchers & Institutions
Top researchers and institutions driving this field (name types/profiles — e.g. "computational oncologists at major cancer centers").

## 📈 Current Trends
4-5 active trends shaping the field right now.

## 🔍 Research Gaps
3-4 underexplored areas — specific gaps with high potential impact.

## 🗺️ Literature Review Structure
Suggested structure for a literature review: sections, search keywords, databases to use.

## ⚡ Priority Next Steps
3 immediate actions the researcher should take.

## 🎯 Strategic Assessment
One paragraph: honest assessment of where to focus for maximum impact.

Be specific, research-grade, and actionable. No generic advice.`,
  },
  {
    key: 'collaboration',
    label: 'Collaboration Agent',
    icon: Users,
    color: 'text-accent',
    bg: 'bg-accent/10 border-accent/25',
    activeBg: 'bg-accent/15 border-accent/40',
    description: 'Identifies missing expertise, finds matching researchers & institutions',
    placeholder: 'e.g. I need collaborators for my AI diagnostics project in oncology...',
    prompt: (q) => `You are EYRA Collaboration Agent — an autonomous collaboration intelligence system.

Context: "${q}"

Analyze collaboration needs and output in markdown:

## 🤝 Collaboration Intelligence Report

## 🧩 Missing Expertise Analysis
What skills and expertise are critically missing? (specific domains, not generic)

## 👤 Ideal Collaborator Profiles
5 specific collaborator profiles needed, each with:
- Role/title
- Key skills they bring
- Where to find them (specific conferences, institutions, platforms)

## 🏛️ Target Institutions
4-5 specific types of institutions to approach and why.

## 🌐 Networking Strategy
Step-by-step approach to find and engage the right collaborators.

## 📧 Outreach Template
A professional, concise outreach email template to a potential collaborator.

## 🏆 Compatibility Scoring
What criteria to use when evaluating a potential collaborator (ranked by importance).

## ⚡ This Week's Actions
3 concrete actions to take this week to find collaborators.

Be specific and actionable — like an experienced research network strategist.`,
  },
  {
    key: 'funding',
    label: 'Funding Agent',
    icon: Award,
    color: 'text-chart-3',
    bg: 'bg-chart-3/10 border-chart-3/25',
    activeBg: 'bg-chart-3/15 border-chart-3/40',
    description: 'Retrieves official funding listings and helps plan eligibility verification',
    placeholder: 'e.g. Find funding for my AI healthcare startup in Europe...',
    prompt: (q) => `You are EYRA Funding Agent — an autonomous funding intelligence system.

Research area/project: "${q}"

Generate a comprehensive funding intelligence report in markdown:

## 💰 Funding Intelligence Report

## 🏆 Top Funding Opportunities
8 specific funding programs (grants, VC, accelerators, competitions):
For each: Name | Type | Amount | Eligibility | Deadline | Match Score (1-10) | Why it fits

## 🎯 Eligibility Analysis
What stage and profile makes this project most competitive for funding?

## 📊 Funding Landscape
Overview of the funding ecosystem for this area — who funds what, at what stage.

## 🌍 Geographic Opportunities
Best regions/countries offering relevant funding and why.

## ⚠️ Common Rejection Reasons
Top 3 reasons similar projects get rejected — and how to avoid them.

## 📋 Application Readiness Checklist
10-point checklist: what to prepare before applying.

## ⚡ 30-Day Funding Action Plan
Week-by-week plan to pursue funding over the next month.

Be specific about real funding programs and realistic about eligibility.`,
  },
  {
    key: 'grant',
    label: 'Grant Agent',
    icon: FileText,
    color: 'text-green-400',
    bg: 'bg-green-500/10 border-green-500/25',
    activeBg: 'bg-green-500/15 border-green-500/35',
    description: 'Analyzes call requirements, builds proposal structure, drafts sections',
    placeholder: 'e.g. Help me apply to Horizon Europe for my AI drug discovery project...',
    prompt: (q) => `You are EYRA Grant Agent — an autonomous grant writing intelligence system.

Grant/project context: "${q}"

Build a grant application workspace in markdown:

## 📝 Grant Application Workspace

## 📋 Call Requirements Analysis
Key requirements, evaluation criteria, and what reviewers look for.

## ✅ Application Checklist
Step-by-step checklist with deadlines and owners.

## 🏗️ Proposal Structure
Recommended sections with word count targets:
- Executive Summary
- Problem Statement
- Methodology
- Innovation
- Impact
- Team
- Budget outline
- Dissemination plan

## ✍️ Draft: Executive Summary
Write a 150-word draft executive summary based on the project context.

## ✍️ Draft: Problem Statement
Write a 150-word draft problem statement.

## 🤝 Consortium Partners Needed
If consortium required: 3-4 types of partners to include and their role.

## ⚠️ Key Risks to Address
What risk sections must cover.

## 📅 Timeline to Submission
Backward planning from submission deadline.

Be practical and grant-writing focused — like a professional proposal writer.`,
  },
  {
    key: 'startup',
    label: 'Startup Agent',
    icon: Rocket,
    color: 'text-amber-400',
    bg: 'bg-amber-500/10 border-amber-500/25',
    activeBg: 'bg-amber-500/15 border-amber-500/35',
    description: 'Creates business model, MVP roadmap, competitive analysis & funding strategy',
    placeholder: 'e.g. Turn my federated learning research into a B2B healthcare startup...',
    prompt: (q) => `You are EYRA Startup Agent — an autonomous startup strategy system.

Idea/project: "${q}"

Generate a full Startup Blueprint in markdown:

## 🚀 Startup Blueprint

## 💡 Startup Concept
Value proposition in one sentence. Core insight that makes this viable.

## 🎯 Problem & Solution
Specific problem, solution approach, and why now is the right time.

## 👥 Customer Segments
3 primary segments with size estimates and willingness to pay.

## 💵 Business Model
3-4 revenue streams with realistic pricing models.

## 🏆 Competitive Landscape
4 competitors: strengths, weaknesses, your key differentiator vs each.

## 🛠️ MVP Definition
Minimum viable product: exactly what to build in 8 weeks and why.

## 🗺️ 3-Phase Roadmap
Phase 1 (0-3mo): Validate · Phase 2 (3-9mo): Build · Phase 3 (9-18mo): Scale

## 💰 Funding Strategy
Recommended path: bootstrap → grants → angels → seed. With specific targets.

## 📣 Go-to-Market
First 90-day launch plan with 5 concrete distribution tactics.

## ⚠️ Top 3 Risks & Mitigations

## 🧑‍💼 Team Requirements
Critical founding team roles and what to hire first.

Think like a seasoned partner at a top venture firm — be honest and specific.`,
  },
];

export default function EyraAgentPanel({ open, onClose, contextHint = '' }) {
  const [activeAgent, setActiveAgent] = useState(null);
  const [query, setQuery] = useState('');
  const [result, setResult] = useState(null);
  const [loading, setLoading] = useState(false);
  const [errorMessage, setErrorMessage] = useState('');
  const [sources, setSources] = useState([]);
  const [sourceNotice, setSourceNotice] = useState('');
  const [stage, setStage] = useState('idle');
  const abortRef = useRef(null);
  const requestVersion = useRef(0);

  const cancelPending = () => {
    requestVersion.current += 1;
    abortRef.current?.abort();
    abortRef.current = null;
    setLoading(false);
    setStage('idle');
  };
  useEffect(() => () => {
    requestVersion.current += 1;
    abortRef.current?.abort();
  }, []);

  const handleRun = async () => {
    const topic = query.trim();
    if (!activeAgent || !topic || loading) return;
    if (topic.length > 500 || (activeAgent === 'funding' && topic.length > 240)) {
      setErrorMessage(activeAgent === 'funding'
        ? 'Enter up to 240 characters for funding search. Your question was not shortened.'
        : 'Enter up to 500 characters. Your question was not shortened.');
      return;
    }
    const agent = AGENTS.find(a => a.key === activeAgent);
    if (!agent) return;
    const version = ++requestVersion.current;
    const controller = new AbortController();
    abortRef.current?.abort();
    abortRef.current = controller;
    setLoading(true);
    setErrorMessage('');
    setResult(null);
    setSources([]);
    setSourceNotice('');
    setStage('retrieving');
    let sourceRetrievalComplete = false;
    try {
      let evidence = { status: 'planning_only', context: '', records: [] };
      if (activeAgent === 'research') {
        const bundle = await searchAllPapersWithStatus(topic, {
          limit: 8, level: 'researcher', goal: 'review', recency: 'balanced',
          signal: controller.signal,
        });
        if (controller.signal.aborted || requestVersion.current !== version) return;
        evidence = buildEyraAgentEvidence('research', bundle.papers);
        if (bundle.unavailable_source_count > 0) {
          setSourceNotice('Some scholarly indexes were unavailable. These are retrieved records from the available indexes, not a complete literature review.');
        }
        if (!evidence.records.length) throw new Error('NO_VERIFIED_AGENT_SOURCES');
      } else if (activeAgent === 'funding') {
        const funding = await searchFundingOpportunities(topic, 8, { signal: controller.signal });
        if (controller.signal.aborted || requestVersion.current !== version) return;
        evidence = buildEyraAgentEvidence('funding', funding.items);
        if (funding.partial_results) {
          setSourceNotice('Some official funding portals were unavailable. Confirm eligibility and dates on the linked source.');
        }
        if (!evidence.records.length) throw new Error('NO_VERIFIED_AGENT_SOURCES');
      } else {
        setSourceNotice('This is an AI planning draft, not a live research or funding verification.');
      }
      sourceRetrievalComplete = true;
      setSources(evidence.records);
      setStage('analyzing');
      const prompt = buildEyraAgentPrompt(agent.prompt(topic), activeAgent, evidence);
      const answer = await base44.integrations.Core.InvokeLLM({
        prompt, signal: controller.signal,
      });
      if (controller.signal.aborted || requestVersion.current !== version) return;
      if (typeof answer !== 'string' || !answer.trim()) {
        throw new Error('EMPTY_AGENT_RESPONSE');
      }
      setResult(answer);
    } catch (error) {
      if (controller.signal.aborted || requestVersion.current !== version) return;
      if (error?.message === 'NO_VERIFIED_AGENT_SOURCES') {
        setErrorMessage(activeAgent === 'research'
          ? 'No source-linked publications were retrieved. EYRA did not invent a literature report. Try a different topic or search Papers in EYLO.'
          : 'No official funding listings were retrieved. EYRA did not invent grants, amounts or deadlines. Change the search or retry.');
      } else if (!sourceRetrievalComplete) {
        setErrorMessage(activeAgent === 'funding'
          ? 'Official funding search is temporarily unavailable. EYRA did not generate unsupported grants. Retry later.'
          : 'Academic source search is temporarily unavailable. EYRA did not generate unsupported research findings. Retry later.');
      } else {
        setErrorMessage(eyraAgentFailureMessage(error));
      }
    } finally {
      if (requestVersion.current === version) {
        abortRef.current = null;
        setLoading(false);
        setStage('idle');
      }
    }
  };

  const handleAgentSelect = key => {
    cancelPending();
    setActiveAgent(key);
    setResult(null);
    setErrorMessage('');
    setSourceNotice('');
    setSources([]);
    if (contextHint && !query) setQuery(contextHint.slice(0, 500));
  };

  const reset = () => {
    cancelPending();
    setResult(null);
    setQuery('');
    setErrorMessage('');
    setSourceNotice('');
    setSources([]);
  };

  const closePanel = () => {
    cancelPending();
    onClose();
  };

  if (!open) return null;

  const selectedAgent = AGENTS.find(a => a.key === activeAgent);

  return (
    <AnimatePresence>
      <motion.div
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        exit={{ opacity: 0 }}
        className="fixed inset-0 z-[100] flex items-center justify-center p-4"
        style={{ background: 'rgba(0,0,0,0.75)', backdropFilter: 'blur(10px)' }}
        onClick={e => e.target === e.currentTarget && closePanel()}
      >
        <motion.div
          initial={{ opacity: 0, y: 30, scale: 0.96 }}
          animate={{ opacity: 1, y: 0, scale: 1 }}
          exit={{ opacity: 0, y: 20 }}
          transition={{ type: 'spring', damping: 26, stiffness: 280 }}
          className="w-full max-w-3xl max-h-[90vh] bg-background border border-border/80 rounded-2xl flex flex-col overflow-hidden"
          style={{ boxShadow: '0 0 80px -15px hsla(199,100%,55%,0.3), 0 0 150px -40px hsla(252,85%,65%,0.2)' }}
        >
          {/* Header */}
          <div className="flex items-center gap-3 px-5 py-4 border-b border-border/60 flex-shrink-0">
            <div className="w-9 h-9 rounded-xl eyra-gradient flex items-center justify-center">
              <Brain size={16} className="text-white" />
            </div>
            <div className="flex-1">
              <p className="text-sm font-bold text-foreground">EYRA Agent System</p>
              <p className="text-[10px] text-muted-foreground">Evidence-aware research and planning assistants</p>
            </div>
            <button type="button" aria-label="Close EYRA agents" onClick={closePanel} className="p-2 rounded-lg hover:bg-secondary text-muted-foreground">
              <X size={15} />
            </button>
          </div>

          <div className="flex-1 overflow-y-auto">
            {/* Agent selector */}
            <div className="p-4 border-b border-border/40">
              <p className="text-[10px] font-semibold uppercase tracking-widest text-muted-foreground mb-3">Select Agent</p>
              <div className="grid grid-cols-2 sm:grid-cols-5 gap-2">
                {AGENTS.map(agent => {
                  const Icon = agent.icon;
                  const isActive = activeAgent === agent.key;
                  return (
                    <button
                      key={agent.key}
                      onClick={() => handleAgentSelect(agent.key)}
                      className={`flex flex-col items-center gap-1.5 p-3 rounded-xl border text-center transition-all ${
                        isActive ? agent.activeBg : 'border-border bg-card hover:border-border/80 hover:bg-secondary/40'
                      }`}
                    >
                      <Icon size={16} className={isActive ? agent.color : 'text-muted-foreground'} />
                      <span className={`text-[10px] font-semibold leading-tight ${isActive ? agent.color : 'text-muted-foreground'}`}>
                        {agent.label.replace(' Agent', '')}
                      </span>
                    </button>
                  );
                })}
              </div>
            </div>

            {/* Input */}
            {activeAgent && !result && (
              <motion.div
                initial={{ opacity: 0, y: 8 }}
                animate={{ opacity: 1, y: 0 }}
                className="p-5 border-b border-border/40"
              >
                <div className="flex items-start gap-3 mb-4">
                  <div className={`w-8 h-8 rounded-lg border flex items-center justify-center flex-shrink-0 ${selectedAgent.bg}`}>
                    {React.createElement(selectedAgent.icon, { size: 14, className: selectedAgent.color })}
                  </div>
                  <div>
                    <p className="text-sm font-semibold text-foreground">{selectedAgent.label}</p>
                    <p className="text-xs text-muted-foreground">{selectedAgent.description}</p>
                  </div>
                </div>
                <textarea
                  value={query}
                  onChange={e => setQuery(e.target.value)}
                  maxLength={500}
                  aria-label="EYRA agent research question"
                  placeholder={selectedAgent.placeholder}
                  rows={3}
                  className="w-full px-4 py-3 rounded-xl border border-border bg-secondary text-sm text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-1 focus:ring-primary/40 focus:border-primary/40 resize-none mb-3"
                />
                <button
                  onClick={handleRun}
                  disabled={!query.trim() || loading}
                  className="flex items-center gap-2 px-5 py-2.5 rounded-xl eyra-gradient text-white text-sm font-semibold disabled:opacity-40"
                >
                  {loading ? <Loader2 size={14} className="animate-spin" /> : <Sparkles size={14} />}
                  {loading ? `${selectedAgent.label} is working...` : `Run ${selectedAgent.label}`}
                </button>
              </motion.div>
            )}

            {errorMessage && !loading && (
              <div role="alert" className="mx-5 my-3 rounded-xl border border-destructive/30 bg-destructive/5 px-4 py-3 text-sm text-foreground">
                <span className="flex items-start gap-2"><AlertCircle size={17} aria-hidden="true" className="mt-0.5 shrink-0 text-destructive" />{errorMessage}</span>
                <p className="mt-2 text-xs text-muted-foreground">Your question is preserved. You can retry without losing it.</p>
              </div>
            )}

            {(sourceNotice || sources.length > 0) && !loading && (
              <section aria-label="EYRA retrieved evidence" className="mx-5 my-3 rounded-xl border border-border bg-card p-4">
                <p className="text-xs font-semibold text-foreground">{sources.length ? `${sources.length} source-linked records retrieved` : 'Evidence status'}</p>
                <p className="mt-1 text-xs text-muted-foreground">
                  {sourceNotice || 'Records are indexed source metadata, not full-text claim verification. Confirm scientific claims and current conditions on the original sites.'}
                </p>
                {sources.length > 0 && (
                  <ul className="mt-3 space-y-2">
                    {sources.map(source => (
                      <li key={source.id} className="flex items-start gap-2 text-xs">
                        <span className="shrink-0 font-semibold text-primary">[{source.id}]</span>
                        <a href={source.url} target="_blank" rel="noopener noreferrer" className="inline-flex items-start gap-1 text-foreground underline underline-offset-2 hover:text-primary">
                          {source.title} <ExternalLink size={12} className="shrink-0" aria-hidden="true" />
                        </a>
                        <span className="text-muted-foreground">({source.source})</span>
                      </li>
                    ))}
                  </ul>
                )}
              </section>
            )}

            {/* Loading */}
            {loading && (
              <div className="p-8 flex flex-col items-center gap-3">
                <div className="w-14 h-14 rounded-2xl eyra-gradient flex items-center justify-center animate-pulse-glow">
                  {React.createElement(selectedAgent.icon, { size: 22, className: 'text-white' })}
                </div>
                <p className="text-sm font-semibold text-foreground">{selectedAgent.label} is operating...</p>
                <p className="text-xs text-muted-foreground">{stage === 'retrieving' ? 'Retrieving real source records…' : 'Analyzing retrieved evidence and drafting a response…'}</p>
                <div className="flex gap-1.5 mt-2">
                  {[0, 1, 2, 3, 4].map(i => (
                    <div key={i} className="w-1.5 h-1.5 rounded-full bg-primary animate-bounce" style={{ animationDelay: `${i * 0.1}s` }} />
                  ))}
                </div>
              </div>
            )}

            {/* Result */}
            {result && !loading && (
              <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="p-5">
                <div className="flex items-center justify-between mb-4">
                  <div className="flex items-center gap-2">
                    <div className={`w-7 h-7 rounded-lg border flex items-center justify-center ${selectedAgent.bg}`}>
                      {React.createElement(selectedAgent.icon, { size: 13, className: selectedAgent.color })}
                    </div>
                    <span className="text-xs font-semibold text-foreground">{selectedAgent.label} · AI draft</span>
                  </div>
                  <div className="flex items-center gap-2">
                    <button
                      onClick={reset}
                      className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg border border-border text-xs text-muted-foreground hover:text-foreground hover:bg-secondary transition-colors"
                    >
                      <RefreshCw size={11} /> New Query
                    </button>
                    <button
                      onClick={handleRun}
                      className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg border border-primary/30 text-xs text-primary hover:bg-primary/5 transition-colors"
                    >
                      <Sparkles size={11} /> Regenerate
                    </button>
                  </div>
                </div>
                <div className="prose prose-sm max-w-none prose-headings:text-foreground prose-headings:font-bold prose-headings:text-sm prose-p:text-muted-foreground prose-li:text-muted-foreground prose-strong:text-foreground prose-p:my-1.5 prose-ul:my-1.5 prose-headings:mt-4 prose-headings:mb-2">
                  <ReactMarkdown>{result}</ReactMarkdown>
                  <p className="mt-5 rounded-lg border border-border p-3 text-xs text-muted-foreground">AI interpretation is not scientific verification. For research and funding, consult the original linked sources above before relying on claims, deadlines or eligibility.</p>
                </div>
              </motion.div>
            )}

            {/* Idle state */}
            {!activeAgent && (
              <div className="p-8 text-center">
                <div className="w-16 h-16 rounded-2xl eyra-gradient flex items-center justify-center mx-auto mb-4 animate-pulse-glow">
                  <Brain size={24} className="text-white" />
                </div>
                <h3 className="font-heading font-bold text-base mb-2">Autonomous Agent System</h3>
                <p className="text-sm text-muted-foreground max-w-sm mx-auto">
                  Choose a specialist assistant. Research and funding modes first retrieve genuine source records; other modes produce clearly labeled planning drafts. No external writes are performed.
                </p>
                <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 mt-6 text-left">
                  {[
                    { icon: Search, label: 'Research Intelligence', desc: 'Source-linked publications with tentative gaps & roadmap' },
                    { icon: Award, label: 'Funding Discovery', desc: 'Official records with eligibility checks to confirm' },
                    { icon: Rocket, label: 'Startup Blueprint', desc: 'Complete business model to MVP roadmap' },
                  ].map(item => {
                    const Icon = item.icon;
                    return (
                      <div key={item.label} className="p-3 rounded-xl border border-border bg-card">
                        <Icon size={14} className="text-primary mb-2" />
                        <p className="text-xs font-semibold text-foreground mb-0.5">{item.label}</p>
                        <p className="text-[10px] text-muted-foreground">{item.desc}</p>
                      </div>
                    );
                  })}
                </div>
              </div>
            )}
          </div>
        </motion.div>
      </motion.div>
    </AnimatePresence>
  );
}
