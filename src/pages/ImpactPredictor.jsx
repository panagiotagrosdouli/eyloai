import React, { useState } from 'react';
import { base44 } from '@/api/base44Client';
import { searchAllPapers } from '@/lib/eyra-api';
import { motion } from 'framer-motion';
import {
  Sparkles, Loader2, Target, DollarSign,
  FileText, Users, Rocket, AlertTriangle, Brain, RefreshCw
} from 'lucide-react';

const PREDICT_TYPES = [
  { key: 'startup', label: 'Startup readiness', icon: Rocket, color: 'text-amber-400' },
  { key: 'funding', label: 'Funding readiness', icon: DollarSign, color: 'text-green-400' },
  { key: 'research', label: 'Research impact pathway', icon: FileText, color: 'text-primary' },
  { key: 'collaboration', label: 'Collaboration readiness', icon: Users, color: 'text-accent' },
];

const EXAMPLES = [
  'AI diagnostics startup targeting oncology, pre-seed stage',
  'Applying for Horizon Europe grant for quantum computing research',
  'Academic paper on federated learning for hospital privacy',
  'Research collaboration between MIT and Pfizer on drug discovery',
];

function ScoreRing({ score, color }) {
  const r = 52;
  const circ = Math.PI * r; // half circle
  const dash = circ * (score / 100);
  return (
    <svg width="130" height="70" viewBox="0 0 130 70">
      <path d="M 10 65 A 55 55 0 0 1 120 65" fill="none" stroke="hsl(var(--border))" strokeWidth="8" strokeLinecap="round" />
      <path d="M 10 65 A 55 55 0 0 1 120 65" fill="none" stroke={color} strokeWidth="8" strokeLinecap="round"
        strokeDasharray={`${dash} ${circ}`} style={{ transition: 'stroke-dasharray 1s ease' }} />
      <text x="65" y="58" textAnchor="middle" fill="white" fontSize="20" fontWeight="900">{score}</text>
      <text x="65" y="72" textAnchor="middle" fill="hsl(var(--muted-foreground))" fontSize="8">/ 100</text>
    </svg>
  );
}

export default function ImpactPredictor() {
  const [query, setQuery] = useState('');
  const [predictType, setPredictType] = useState('startup');
  const [prediction, setPrediction] = useState(null);
  const [loading, setLoading] = useState(false);
  const [evidenceCount, setEvidenceCount] = useState(0);
  const [analysisError, setAnalysisError] = useState('');

  const predict = async (q) => {
    const searchQuery = q || query;
    if (!searchQuery.trim()) return;
    setQuery(searchQuery);
    setLoading(true);
    setPrediction(null);
    setAnalysisError('');

    const typeLabel = PREDICT_TYPES.find(t => t.key === predictType)?.label || 'Impact';

    try {
      const papers = await searchAllPapers(searchQuery);
      setEvidenceCount(papers.length);
      const evidenceContext = papers.slice(0, 10).map((paper, index) =>
        `[P${index + 1}] "${paper.title}" — ${paper.authors || 'Unknown'} (${paper.year || 'n/a'}) — ${paper.cited_by_count || 0} citations — ${paper.url}`
      ).join('\n');

      const result = await base44.integrations.Core.InvokeLLM({
        prompt: `You are EYRA Evidence & Impact Assessor.

ASSESSMENT TYPE: ${typeLabel}
USER INPUT: "${searchQuery}"

VERIFIED SCHOLARLY RECORDS:
${evidenceContext || 'No matching records were retrieved.'}

This is decision support, not a statistically calibrated forecast. Never claim that a score is an empirical probability of success.

Score rubric:
- overall_score and primary_score: evidence readiness and execution plausibility, 0-100
- confidence: evidence coverage for this assessment given the amount and relevance of supplied records, 0-100
- risk_score: model-assessed risk severity, 0-100
Every factual research claim must reference [P] records. Clearly identify user assumptions and missing evidence.

Return:
- subject_summary
- overall_score
- confidence
- verdict: "Promising"|"Strong"|"Moderate"|"Weak"|"High Risk"
- predictions: { primary_score, primary_label, primary_reasoning, secondary_scores: [{label, score, note}] }
- strengths: [{factor, detail}]
- weaknesses: [{factor, detail}]
- key_success_factors: string[]
- risk_score
- top_risk
- timeline_to_outcome
- eyra_prediction: a conditional assessment, never a certainty
- three_actions: string[]`,
        response_json_schema: {
          type: 'object',
          properties: {
            subject_summary: { type: 'string' },
            overall_score: { type: 'number', minimum: 0, maximum: 100 },
            confidence: { type: 'number', minimum: 0, maximum: 100 },
            verdict: { type: 'string', enum: ['Promising', 'Strong', 'Moderate', 'Weak', 'High Risk'] },
            predictions: {
              type: 'object',
              properties: {
                primary_score: { type: 'number', minimum: 0, maximum: 100 },
                primary_label: { type: 'string' },
                primary_reasoning: { type: 'string' },
                secondary_scores: {
                  type: 'array',
                  items: {
                    type: 'object',
                    properties: {
                      label: { type: 'string' },
                      score: { type: 'number', minimum: 0, maximum: 100 },
                      note: { type: 'string' },
                    },
                  },
                },
              },
            },
            strengths: { type: 'array', items: { type: 'object', properties: { factor: { type: 'string' }, detail: { type: 'string' } } } },
            weaknesses: { type: 'array', items: { type: 'object', properties: { factor: { type: 'string' }, detail: { type: 'string' } } } },
            key_success_factors: { type: 'array', items: { type: 'string' } },
            risk_score: { type: 'number', minimum: 0, maximum: 100 },
            top_risk: { type: 'string' },
            timeline_to_outcome: { type: 'string' },
            eyra_prediction: { type: 'string' },
            three_actions: { type: 'array', items: { type: 'string' } },
          },
        },
      });

      setPrediction(result);
    } catch (error) {
      setAnalysisError(error instanceof Error ? error.message : 'Impact assessment did not complete.');
    } finally {
      setLoading(false);
    }
  };

  const verdictConfig = {
    'Promising': 'text-green-400 bg-green-500/15 border-green-500/25',
    'Strong': 'text-primary bg-primary/15 border-primary/25',
    'Moderate': 'text-amber-400 bg-amber-500/15 border-amber-500/25',
    'Weak': 'text-red-400 bg-red-500/15 border-red-500/25',
    'High Risk': 'text-red-400 bg-red-500/15 border-red-500/25',
  };

  const scoreColor = (s) => s >= 70 ? '#22c55e' : s >= 50 ? 'hsl(199,100%,55%)' : s >= 35 ? '#f59e0b' : '#ef4444';

  return (
    <div className="max-w-5xl mx-auto px-4 py-8">
      {/* Header */}
      <div className="mb-6">
        <h1 className="font-heading font-black text-2xl sm:text-3xl text-foreground">Impact Review</h1>
      </div>

      <div className="mb-4 rounded-xl border border-amber-500/20 bg-amber-500/5 p-3 text-[11px] text-muted-foreground">
        Scores are model-based decision-support estimates, not statistically calibrated probabilities or guarantees.
      </div>
      {analysisError && (
        <div role="alert" className="mb-4 rounded-xl border border-red-500/20 bg-red-500/5 p-3 text-xs text-red-300">
          {analysisError}
        </div>
      )}

      {/* Type selector */}
      <div className="flex gap-2 mb-4 flex-wrap">
        {PREDICT_TYPES.map(t => {
          const Icon = t.icon;
          const isActive = predictType === t.key;
          return (
            <button
              key={t.key}
              onClick={() => setPredictType(t.key)}
              className={`flex items-center gap-1.5 px-4 py-2 rounded-lg border text-xs font-semibold transition-all ${
                isActive ? `bg-primary/10 border-primary/30 text-primary` : 'border-border text-muted-foreground hover:border-border/80 hover:text-foreground'
              }`}
            >
              <Icon size={12} className={isActive ? 'text-primary' : 'text-muted-foreground'} />
              {t.label}
            </button>
          );
        })}
      </div>

      {/* Input */}
      <div className="mb-6">
        <form onSubmit={e => { e.preventDefault(); predict(); }} className="flex gap-2">
          <div className="flex-1 relative">
            <Sparkles size={15} className="absolute left-4 top-1/2 -translate-y-1/2 text-primary" />
            <input
              type="text"
              value={query}
              onChange={e => setQuery(e.target.value)}
              placeholder="Describe your project, startup, grant, or research..."
              className="w-full h-12 pl-11 pr-4 rounded-xl border border-border bg-secondary text-sm text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-1 focus:ring-primary/40"
            />
          </div>
          <button type="submit" disabled={!query.trim() || loading} className="flex items-center gap-2 px-6 py-3 rounded-xl eyra-gradient text-white text-sm font-semibold disabled:opacity-40">
            {loading ? <Loader2 size={14} className="animate-spin" /> : <Target size={14} />}
            Assess
          </button>
        </form>
        {!prediction && !loading && (
          <div className="flex flex-wrap gap-2 mt-3">
            {EXAMPLES.map(ex => (
              <button key={ex} onClick={() => predict(ex)} className="px-3 py-1.5 rounded-full border border-border/60 bg-secondary/40 text-xs text-muted-foreground hover:text-foreground hover:border-primary/40 transition-all">
                {ex}
              </button>
            ))}
          </div>
        )}
      </div>

      {loading && (
        <div className="flex flex-col items-center justify-center py-20">
          <div className="w-16 h-16 rounded-2xl eyra-gradient flex items-center justify-center mb-5 animate-pulse-glow">
            <Brain size={26} className="text-white" />
          </div>
          <p className="text-sm font-semibold mb-1">EYRA is assessing evidence and execution readiness...</p>
          <p className="text-xs text-muted-foreground">Retrieving scholarly records, then evaluating assumptions and risks</p>
          <div className="flex gap-1.5 mt-4">
            {[0,1,2,3,4].map(i => (
              <div key={i} className="w-1.5 h-1.5 rounded-full bg-primary animate-bounce" style={{ animationDelay: `${i * 0.1}s` }} />
            ))}
          </div>
        </div>
      )}

      {prediction && !loading && (
        <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} className="space-y-5">
          <div className="flex items-center gap-2 rounded-xl border border-green-500/20 bg-green-500/5 px-3 py-2 text-[11px] text-muted-foreground">
            <FileText size={11} className="text-green-400" />
            Assessment grounded in {evidenceCount} retrieved scholarly records. Scores remain model estimates.
          </div>

          {/* Hero score */}
          <div className="p-6 rounded-2xl border border-border bg-card flex flex-col sm:flex-row items-center gap-6">
            <div className="flex flex-col items-center">
              <ScoreRing score={prediction.overall_score} color={scoreColor(prediction.overall_score)} />
              <span className={`text-xs font-bold px-3 py-1 rounded-full border mt-2 ${verdictConfig[prediction.verdict] || 'text-muted-foreground border-border'}`}>
                {prediction.verdict}
              </span>
            </div>
            <div className="flex-1 text-center sm:text-left">
              <p className="text-sm text-foreground/80 mb-3">{prediction.subject_summary}</p>
              <div className="flex items-center gap-4 justify-center sm:justify-start">
                <div>
                  <p className="text-[10px] text-muted-foreground">Evidence coverage</p>
                  <p className="text-lg font-bold text-foreground">{prediction.confidence}/100</p>
                </div>
                <div>
                  <p className="text-[10px] text-muted-foreground">Risk Score</p>
                  <p className="text-lg font-bold text-red-400">{prediction.risk_score}/100</p>
                </div>
                <div>
                  <p className="text-[10px] text-muted-foreground">Timeline</p>
                  <p className="text-lg font-bold text-foreground">{prediction.timeline_to_outcome}</p>
                </div>
              </div>
            </div>
          </div>

          {/* Secondary scores */}
          {prediction.predictions?.secondary_scores && (
            <div className="space-y-2">
              <p className="text-[10px] font-semibold uppercase tracking-widest text-muted-foreground">Breakdown</p>
              {prediction.predictions.secondary_scores.map((s, i) => (
                <div key={i} className="flex items-center gap-4 p-3 rounded-xl border border-border bg-card">
                  <p className="text-xs font-medium text-foreground w-36 flex-shrink-0">{s.label}</p>
                  <div className="flex-1 h-2 rounded-full bg-border overflow-hidden">
                    <div className="h-full rounded-full transition-all" style={{ width: `${s.score}%`, backgroundColor: scoreColor(s.score) }} />
                  </div>
                  <p className="text-xs font-bold w-8 text-right flex-shrink-0" style={{ color: scoreColor(s.score) }}>{s.score}</p>
                  <p className="text-[10px] text-muted-foreground flex-1 hidden sm:block">{s.note}</p>
                </div>
              ))}
            </div>
          )}

          {/* Strengths + Weaknesses */}
          <div className="grid sm:grid-cols-2 gap-4">
            {prediction.strengths?.length > 0 && (
              <div className="p-4 rounded-xl border border-green-500/20 bg-green-500/5">
                <p className="text-[10px] font-semibold uppercase tracking-wider text-green-400 mb-3">Strengths</p>
                <div className="space-y-2.5">
                  {prediction.strengths.map((s, i) => (
                    <div key={i}>
                      <p className="text-xs font-semibold text-foreground">{s.factor}</p>
                      <p className="text-[10px] text-muted-foreground">{s.detail}</p>
                    </div>
                  ))}
                </div>
              </div>
            )}
            {prediction.weaknesses?.length > 0 && (
              <div className="p-4 rounded-xl border border-red-500/20 bg-red-500/5">
                <p className="text-[10px] font-semibold uppercase tracking-wider text-red-400 mb-3 flex items-center gap-1.5">
                  <AlertTriangle size={9} /> Risks & Weaknesses
                </p>
                <div className="space-y-2.5">
                  {prediction.weaknesses.map((w, i) => (
                    <div key={i}>
                      <p className="text-xs font-semibold text-foreground">{w.factor}</p>
                      <p className="text-[10px] text-muted-foreground">{w.detail}</p>
                    </div>
                  ))}
                </div>
              </div>
            )}
          </div>

          {/* EYRA prediction */}
          <div className="p-5 rounded-2xl border border-primary/20 bg-primary/5">
            <div className="flex items-center gap-2 mb-2">
              <Sparkles size={12} className="text-primary" />
              <span className="text-[10px] font-bold text-primary uppercase tracking-widest">EYRA's Verdict</span>
            </div>
            <p className="text-sm text-foreground/85 leading-relaxed mb-4">{prediction.eyra_prediction}</p>
            {prediction.three_actions?.length > 0 && (
              <div>
                <p className="text-[10px] font-semibold uppercase tracking-wider text-muted-foreground mb-2">3 Actions to Improve Your Odds</p>
                <div className="space-y-1.5">
                  {prediction.three_actions.map((a, i) => (
                    <div key={i} className="flex items-start gap-2">
                      <div className="w-5 h-5 rounded-full eyra-gradient flex items-center justify-center text-white text-[9px] font-bold flex-shrink-0 mt-0.5">{i + 1}</div>
                      <p className="text-xs text-foreground/80">{a}</p>
                    </div>
                  ))}
                </div>
              </div>
            )}
          </div>

          {prediction.top_risk && (
            <div className="flex items-start gap-3 p-4 rounded-xl border border-amber-500/20 bg-amber-500/5">
              <AlertTriangle size={14} className="text-amber-400 mt-0.5 flex-shrink-0" />
              <div>
                <p className="text-[10px] font-semibold text-amber-400 uppercase tracking-wider mb-0.5">Top Risk</p>
                <p className="text-xs text-foreground/80">{prediction.top_risk}</p>
              </div>
            </div>
          )}

          <button onClick={() => predict()} className="flex items-center gap-1.5 text-xs text-muted-foreground hover:text-primary transition-colors">
            <RefreshCw size={11} /> Recalculate prediction
          </button>
        </motion.div>
      )}
    </div>
  );
}
