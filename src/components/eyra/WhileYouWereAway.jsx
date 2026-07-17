import React, { useState, useEffect } from 'react';
import {
  FileText, Users, TrendingUp, AlertTriangle, Sparkles,
  ExternalLink, ChevronDown, ChevronUp, Loader2,
  CheckCircle, Clock, Zap, Brain, Shield
} from 'lucide-react';
import { runMonitor, analyzeDiscoveries, getLastVisitTimestamp } from '@/lib/eyra-monitor';

const PRIORITY_CONFIG = {
  CRITICAL: { color: 'bg-red-500/10 border-red-500/30 text-red-400', dot: 'bg-red-400', label: 'Critical' },
  HIGH:     { color: 'bg-amber-500/10 border-amber-500/30 text-amber-400', dot: 'bg-amber-400', label: 'High' },
  MEDIUM:   { color: 'bg-primary/10 border-primary/30 text-primary', dot: 'bg-primary', label: 'Medium' },
  LOW:      { color: 'bg-secondary border-border text-muted-foreground', dot: 'bg-muted-foreground/40', label: 'Low' },
};

const TYPE_CONFIG = {
  paper:      { icon: FileText, label: '✓ Real Paper', color: 'text-primary bg-primary/10' },
  researcher: { icon: Users,    label: '✓ Real Researcher', color: 'text-cyan-400 bg-cyan-500/10' },
  gap:        { icon: Brain,    label: '🧠 EYRA Insight', color: 'text-purple-400 bg-purple-500/10' },
  trend:      { icon: TrendingUp, label: '🧠 EYRA Analysis', color: 'text-green-400 bg-green-500/10' },
};

const CONFIDENCE_CONFIG = {
  HIGH:   'text-green-400 bg-green-500/10 border-green-500/20',
  MEDIUM: 'text-amber-400 bg-amber-500/10 border-amber-500/20',
  LOW:    'text-muted-foreground bg-secondary border-border',
};

function DiscoveryCard({ item }) {
  const [expanded, setExpanded] = useState(false);
  const typeCfg = TYPE_CONFIG[item.type] || TYPE_CONFIG.trend;
  const priorityCfg = PRIORITY_CONFIG[item.priority] || PRIORITY_CONFIG.LOW;
  const confCfg = CONFIDENCE_CONFIG[item.confidence] || CONFIDENCE_CONFIG.MEDIUM;
  const Icon = typeCfg.icon;

  return (
    <div className={`rounded-xl border p-4 transition-all ${priorityCfg.color}`}>
      <div className="flex items-start gap-3">
        <div className={`w-8 h-8 rounded-lg flex items-center justify-center flex-shrink-0 ${typeCfg.color}`}>
          <Icon size={14} />
        </div>
        <div className="flex-1 min-w-0">
          {/* Labels row */}
          <div className="flex items-center gap-1.5 mb-1.5 flex-wrap">
            <span className="text-[9px] px-1.5 py-0.5 rounded font-bold bg-secondary/60 text-muted-foreground uppercase tracking-wider">
              {typeCfg.label}
            </span>
            <span className={`text-[9px] px-1.5 py-0.5 rounded-full font-semibold border ${confCfg}`}>
              <Shield size={7} className="inline mr-0.5" />{item.confidence}
            </span>
            <span className="flex items-center gap-1 text-[9px] text-muted-foreground">
              <div className={`w-1.5 h-1.5 rounded-full ${priorityCfg.dot}`} />
              {priorityCfg.label} Priority
            </span>
          </div>

          <h4 className="font-semibold text-sm text-foreground leading-snug mb-1">{item.title}</h4>
          <p className="text-xs text-muted-foreground leading-relaxed">{item.description}</p>

          {/* Why relevant */}
          {item.why_relevant && (
            <div className="flex items-start gap-1.5 mt-2 p-2 rounded-lg bg-secondary/40">
              <Sparkles size={9} className="flex-shrink-0 mt-0.5 text-muted-foreground" />
              <p className="text-[10px] text-muted-foreground leading-relaxed">{item.why_relevant}</p>
            </div>
          )}

          {/* Expandable: Evidence + Action */}
          {expanded && (
            <div className="mt-3 space-y-2">
              {item.data_ref && (
                <div className="p-2.5 rounded-lg bg-secondary/50 border border-border/50">
                  <p className="text-[9px] font-bold uppercase tracking-wider text-muted-foreground mb-1">Evidence</p>
                  <p className="text-[11px] font-medium text-foreground">"{item.data_ref}"</p>
                  {item.source && <p className="text-[9px] text-muted-foreground mt-0.5">Source: {item.source}</p>}
                </div>
              )}
              {item.action && (
                <div className="flex items-start gap-2 p-2.5 rounded-lg bg-secondary/50">
                  <Zap size={10} className="flex-shrink-0 mt-0.5 text-muted-foreground" />
                  <div>
                    <p className="text-[9px] font-bold uppercase tracking-wider text-muted-foreground mb-0.5">Recommended Action</p>
                    <p className="text-[11px] font-medium text-foreground">{item.action}</p>
                  </div>
                </div>
              )}
            </div>
          )}

          <button
            onClick={() => setExpanded(!expanded)}
            className="mt-2 text-[10px] font-semibold flex items-center gap-1 text-muted-foreground hover:text-foreground transition-colors"
          >
            {expanded ? 'Less' : 'Evidence & Action'}
            {expanded ? <ChevronUp size={10} /> : <ChevronDown size={10} />}
          </button>
        </div>
      </div>
    </div>
  );
}

export default function WhileYouWereAway({ projects, searchHistory }) {
  const [state, setState] = useState('idle'); // idle | loading | done | empty
  const [monitorResult, setMonitorResult] = useState(null);
  const [analysis, setAnalysis] = useState(null);
  const [collapsed, setCollapsed] = useState(false);
  const lastVisit = getLastVisitTimestamp();

  useEffect(() => {
    if (!projects || projects.length === 0) return;
    load();
  }, [projects?.length]);

  const load = async () => {
    setState('loading');
    const result = await runMonitor(projects || [], searchHistory || []);
    setMonitorResult(result);

    if (result.noData) {
      setState('empty');
      return;
    }

    const analyzed = await analyzeDiscoveries(result, projects || []);
    setAnalysis(analyzed);
    setState('done');
  };

  const totalDiscoveries = (monitorResult?.papers?.length || 0) + (monitorResult?.researchers?.length || 0);
  const highPriorityCount = analysis?.items?.filter(i => i.priority === 'HIGH' || i.priority === 'CRITICAL').length || 0;

  return (
    <div className="rounded-2xl border border-border bg-card overflow-hidden">
      {/* Header */}
      <div
        className="flex items-center gap-3 px-5 py-4 cursor-pointer hover:bg-secondary/20 transition-colors"
        onClick={() => setCollapsed(!collapsed)}
      >
        <div className="relative flex-shrink-0">
          <div className="w-9 h-9 rounded-xl overflow-hidden bg-white">
            <img
              src="https://media.base44.com/images/public/6a3b660e73254d1b4bf55bcb/33f475246_image.png"
              alt="EYRA" className="w-full h-full object-contain"
            />
          </div>
          <div className="absolute -bottom-0.5 -right-0.5 w-3 h-3 rounded-full bg-green-400 border-2 border-background" />
        </div>
        <div className="flex-1 min-w-0">
          <p className="text-[10px] font-bold uppercase tracking-widest text-muted-foreground/60 mb-0.5">
            While You Were Away
          </p>
          <p className="text-sm font-semibold text-foreground">
            {state === 'loading' && 'EYRA is scanning OpenAlex, arXiv, Europe PMC...'}
            {state === 'done' && `${totalDiscoveries} real discoveries · ${highPriorityCount} high priority`}
            {state === 'empty' && 'No new discoveries — add projects to enable monitoring'}
            {state === 'idle' && 'EYRA autonomous monitoring'}
          </p>
          {lastVisit && state === 'done' && (
            <p className="text-[10px] text-muted-foreground mt-0.5">
              <Clock size={8} className="inline mr-1" />
              Last scanned: {new Date(lastVisit).toLocaleDateString()}
            </p>
          )}
        </div>
        <div className="flex items-center gap-2 flex-shrink-0">
          {state === 'done' && highPriorityCount > 0 && (
            <span className="text-[10px] px-2 py-0.5 rounded-full bg-amber-500/15 text-amber-400 font-bold border border-amber-500/20">
              {highPriorityCount} urgent
            </span>
          )}
          {collapsed ? <ChevronDown size={14} className="text-muted-foreground" /> : <ChevronUp size={14} className="text-muted-foreground" />}
        </div>
      </div>

      {!collapsed && (
        <div className="px-5 pb-5 border-t border-border/40 pt-4">

          {/* Loading */}
          {state === 'loading' && (
            <div className="space-y-3">
              <div className="flex items-center gap-2 text-xs text-muted-foreground">
                <Loader2 size={12} className="animate-spin text-primary" />
                Fetching real data from academic databases...
              </div>
              {[1, 2, 3].map(i => <div key={i} className="h-20 rounded-xl bg-secondary/30 animate-pulse" />)}
            </div>
          )}

          {/* Empty */}
          {state === 'empty' && (
            <p className="text-xs text-muted-foreground text-center py-4">
              EYRA searched but found no relevant papers or researchers. Try adding more detail to your project goals.
            </p>
          )}

          {/* Results */}
          {state === 'done' && (
            <div className="space-y-4">

              {/* Real stats bar */}
              <div className="grid grid-cols-3 gap-2">
                {[
                  { label: 'Real Papers', value: monitorResult.papers.length, color: 'text-primary', icon: FileText },
                  { label: 'Researchers', value: monitorResult.researchers.length, color: 'text-cyan-400', icon: Users },
                  { label: 'Insights', value: analysis?.items?.length || 0, color: 'text-purple-400', icon: Brain },
                ].map(s => {
                  const Icon = s.icon;
                  return (
                    <div key={s.label} className="flex flex-col items-center p-3 rounded-xl bg-secondary/30 text-center">
                      <Icon size={12} className={`${s.color} mb-1`} />
                      <p className={`font-bold text-lg font-heading ${s.color}`}>{s.value}</p>
                      <p className="text-[9px] text-muted-foreground">{s.label}</p>
                    </div>
                  );
                })}
              </div>

              {/* Data reality labels */}
              <div className="flex items-center gap-3 p-2.5 rounded-xl bg-secondary/30 border border-border/40">
                <div className="flex items-center gap-1.5">
                  <CheckCircle size={10} className="text-green-400" />
                  <span className="text-[10px] text-muted-foreground">✓ Real = verified from OpenAlex/arXiv</span>
                </div>
                <div className="flex items-center gap-1.5">
                  <Sparkles size={10} className="text-primary" />
                  <span className="text-[10px] text-muted-foreground">🧠 EYRA = AI analysis of real data</span>
                </div>
              </div>

              {/* Trend + Gap */}
              {(analysis?.trend || analysis?.gap) && (
                <div className="space-y-2">
                  {analysis.trend && (
                    <div className="flex items-start gap-2 p-3 rounded-xl bg-green-500/5 border border-green-500/15">
                      <TrendingUp size={12} className="text-green-400 flex-shrink-0 mt-0.5" />
                      <div>
                        <p className="text-[9px] font-bold uppercase tracking-wider text-green-400/70 mb-0.5">🧠 EYRA Trend Analysis</p>
                        <p className="text-xs text-foreground leading-relaxed">{analysis.trend}</p>
                      </div>
                    </div>
                  )}
                  {analysis.gap && (
                    <div className="flex items-start gap-2 p-3 rounded-xl bg-purple-500/5 border border-purple-500/15">
                      <AlertTriangle size={12} className="text-purple-400 flex-shrink-0 mt-0.5" />
                      <div>
                        <p className="text-[9px] font-bold uppercase tracking-wider text-purple-400/70 mb-0.5">🧠 EYRA Research Gap</p>
                        <p className="text-xs text-foreground leading-relaxed">{analysis.gap}</p>
                      </div>
                    </div>
                  )}
                </div>
              )}

              {/* Intelligence items */}
              {analysis?.items?.length > 0 && (
                <div className="space-y-2">
                  <p className="text-[10px] font-bold uppercase tracking-widest text-muted-foreground/60">
                    Ranked Intelligence
                  </p>
                  {analysis.items.map((item, i) => (
                    <DiscoveryCard key={i} item={item} />
                  ))}
                </div>
              )}

              {/* Real papers list */}
              {monitorResult.papers.length > 0 && (
                <div className="space-y-2">
                  <p className="text-[10px] font-bold uppercase tracking-widest text-muted-foreground/60">
                    ✓ Real Papers Found
                  </p>
                  {monitorResult.papers.slice(0, 4).map((p, i) => (
                    <div key={i} className="flex items-start gap-3 p-3 rounded-xl bg-secondary/30 border border-border/40">
                      <FileText size={11} className="text-primary flex-shrink-0 mt-0.5" />
                      <div className="flex-1 min-w-0">
                        <p className="text-xs font-medium text-foreground leading-tight mb-0.5 line-clamp-2">{p.title}</p>
                        <p className="text-[10px] text-muted-foreground">{p.authors?.slice(0, 50)} · {p.year} · {p.cited_by_count} citations · {p.source_label}</p>
                        {p.why_relevant && <p className="text-[9px] text-primary mt-0.5">{p.why_relevant}</p>}
                      </div>
                      {p.url && (
                        <a href={p.url} target="_blank" rel="noopener noreferrer"
                          className="p-1 rounded hover:bg-secondary transition-colors flex-shrink-0">
                          <ExternalLink size={10} className="text-muted-foreground" />
                        </a>
                      )}
                    </div>
                  ))}
                </div>
              )}

              {/* Real researchers list */}
              {monitorResult.researchers.length > 0 && (
                <div className="space-y-2">
                  <p className="text-[10px] font-bold uppercase tracking-widest text-muted-foreground/60">
                    ✓ Real Researchers Found
                  </p>
                  {monitorResult.researchers.slice(0, 3).map((r, i) => (
                    <div key={i} className="flex items-center gap-3 p-3 rounded-xl bg-secondary/30 border border-border/40">
                      <div className="w-7 h-7 rounded-full bg-cyan-500/10 flex items-center justify-center flex-shrink-0">
                        <Users size={11} className="text-cyan-400" />
                      </div>
                      <div className="flex-1 min-w-0">
                        <p className="text-xs font-semibold text-foreground">{r.name}</p>
                        <p className="text-[10px] text-muted-foreground">{r.institution} · {r.works_count} works</p>
                      </div>
                      {r.profile_url && (
                        <a href={r.profile_url} target="_blank" rel="noopener noreferrer"
                          className="p-1 rounded hover:bg-secondary transition-colors flex-shrink-0">
                          <ExternalLink size={10} className="text-muted-foreground" />
                        </a>
                      )}
                    </div>
                  ))}
                </div>
              )}
            </div>
          )}
        </div>
      )}
    </div>
  );
}
