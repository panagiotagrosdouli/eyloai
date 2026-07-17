import React, { useState } from 'react';
import { motion } from 'framer-motion';
import {
  FileText, Users, Building2, TrendingUp, DollarSign,
  Map, Bookmark, ExternalLink, ChevronRight,
  Award, Target, BookOpen, Sparkles, Brain,
  AlertTriangle, CheckCircle2, Plus, ArrowRight,
  ShieldCheck, Info, Lock
} from 'lucide-react';
import { base44 } from '@/api/base44Client';
import EyraBadge, { EyraSectionLabel } from '@/components/eyra/EyraBadge';
import { useToast } from '@/components/ui/use-toast';
import { Link, useNavigate } from 'react-router-dom';

const TABS = [
  { key: 'overview', label: 'Overview', icon: Target },
  { key: 'papers', label: 'Research', icon: FileText },
  { key: 'researchers', label: 'Researchers', icon: Users },
  { key: 'institutions', label: 'Institutions', icon: Building2 },
  { key: 'roadmap', label: 'Roadmap', icon: Map },
  { key: 'funding', label: 'Funding', icon: DollarSign },
];

const CONFIDENCE_CONFIG = {
  HIGH: { color: 'text-green-400 bg-green-500/10 border-green-500/20', label: 'High confidence' },
  MEDIUM: { color: 'text-amber-400 bg-amber-500/10 border-amber-500/20', label: 'Medium confidence' },
  LOW: { color: 'text-red-400 bg-red-500/10 border-red-500/20', label: 'Low confidence' },
};

function ConfidenceBadge({ level }) {
  const cfg = CONFIDENCE_CONFIG[level] || CONFIDENCE_CONFIG.MEDIUM;
  return (
    <span className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-semibold border ${cfg.color}`}>
      <ShieldCheck size={8} /> {cfg.label}
    </span>
  );
}

function EvidenceNote({ text }) {
  if (!text) return null;
  return (
    <div className="mt-2 flex items-start gap-1.5 text-[10px] text-muted-foreground/70 italic">
      <Info size={10} className="flex-shrink-0 mt-0.5" />
      <span>{text}</span>
    </div>
  );
}

export default function DiscoveryResults({ results, onNewSearch }) {
  const [activeTab, setActiveTab] = useState('overview');
  const [creatingProject, setCreatingProject] = useState(false);
  const [projectCreated, setProjectCreated] = useState(null);
  const { toast } = useToast();
  const navigate = useNavigate();

  const savePaper = async (paper) => {
    await base44.entities.SavedPaper.create({
      title: paper.title,
      authors: paper.authors,
      summary: paper.summary,
      year: paper.year,
      source: paper.source,
      url: paper.url,
    });
    toast({ title: 'Paper saved to library' });
  };

  const saveResearcher = async (r) => {
    await base44.entities.SavedResearcher.create({
      name: r.name,
      institution: r.institution,
      research_areas: r.research_areas,
      works_count: r.works_count,
      citation_count: r.citation_count,
      profile_url: r.profile_url,
    });
    toast({ title: 'Researcher saved to library' });
  };

  const createProject = async () => {
    setCreatingProject(true);
    try {
      const project = await base44.entities.Project.create({
        title: results.query || 'New Research Project',
        goal: results.query,
        eyra_analysis: results.goal_analysis || '',
        status: 'active',
      });
      setProjectCreated(project);
      toast({ title: 'Project workspace created' });
    } catch {
      toast({ title: 'Could not create project', variant: 'destructive' });
    }
    setCreatingProject(false);
  };

  const overallConfidence = results.confidence_overall || (
    (results.papers?.length || 0) >= 8 ? 'HIGH' :
    (results.papers?.length || 0) >= 3 ? 'MEDIUM' : 'LOW'
  );

  return (
    <div className="max-w-5xl mx-auto px-4 pb-20">

      {/* Header */}
      <div className="py-5 mb-2">
        <div className="flex items-start justify-between gap-4">
          <div>
            <div className="flex items-center gap-2 mb-1">
              <EyraSectionLabel label="EYRA Discovery Report" />
              <ConfidenceBadge level={overallConfidence} />
            </div>
            <h2 className="font-heading font-bold text-lg text-foreground">"{results.query}"</h2>
            <p className="text-xs text-muted-foreground mt-0.5">
              {results.papers?.length || 0} papers · {results.researchers?.length || 0} researchers · {results.institutions?.length || 0} institutions
              <span className="ml-2 text-primary/70">· Sources: OpenAlex, arXiv, Europe PMC</span>
            </p>
          </div>

          {!projectCreated ? (
            <button
              onClick={createProject}
              disabled={creatingProject}
              className="flex items-center gap-2 px-5 py-3 rounded-xl eyra-gradient text-white text-sm font-bold hover:opacity-90 transition-opacity disabled:opacity-60 flex-shrink-0"
            >
              {creatingProject
                ? <div className="w-4 h-4 border-2 border-white/40 border-t-white rounded-full animate-spin" />
                : <Plus size={15} />}
              Create Project
            </button>
          ) : (
            <Link to={`/projects/${projectCreated.id}`}
              className="flex items-center gap-2 px-5 py-3 rounded-xl bg-green-500/15 border border-green-500/30 text-green-400 text-sm font-bold flex-shrink-0">
              <CheckCircle2 size={15} /> Open Project
            </Link>
          )}
        </div>

        {projectCreated && (
          <motion.div initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }}
            className="mt-4 p-4 rounded-xl border border-primary/25 bg-primary/5 flex items-start gap-3">
            <div className="w-8 h-8 rounded-lg overflow-hidden bg-white flex-shrink-0">
              <img src="https://media.base44.com/images/public/6a3b660e73254d1b4bf55bcb/33f475246_image.png" alt="EYRA" className="w-full h-full object-contain" />
            </div>
            <div className="flex-1">
              <p className="text-xs font-semibold text-foreground mb-2">Project created. Explore the full report:</p>
              <div className="flex flex-wrap gap-2">
                {[{ label: 'Researchers', tab: 'researchers' }, { label: 'Funding', tab: 'funding' }, { label: 'Roadmap', tab: 'roadmap' }].map(item => (
                  <button key={item.tab} onClick={() => setActiveTab(item.tab)}
                    className="flex items-center gap-1 px-3 py-1.5 rounded-lg bg-primary/10 border border-primary/20 text-xs font-medium text-primary hover:bg-primary/20 transition-colors">
                    <ArrowRight size={10} /> {item.label}
                  </button>
                ))}
                <Link to={`/projects/${projectCreated.id}`}
                  className="flex items-center gap-1 px-3 py-1.5 rounded-lg eyra-gradient text-white text-xs font-medium">
                  <Sparkles size={10} /> Open project →
                </Link>
              </div>
            </div>
          </motion.div>
        )}
      </div>

      {/* Data transparency banner */}
      <div className="mb-5 px-4 py-3 rounded-xl border border-border/50 bg-secondary/30 flex items-center gap-3">
        <Lock size={12} className="text-primary flex-shrink-0" />
        <p className="text-[11px] text-muted-foreground leading-relaxed">
          <span className="font-semibold text-foreground">Real data, grounded analysis.</span> All papers, researchers, and institutions are retrieved live from OpenAlex, arXiv, and Europe PMC. AI insights are generated by analyzing this real data only — not invented.
        </p>
      </div>

      {/* Tab Navigation */}
      <div className="flex items-center gap-1 overflow-x-auto pb-1 mb-6 border-b border-border/60">
        {TABS.map(tab => {
          const Icon = tab.icon;
          return (
            <button key={tab.key} onClick={() => setActiveTab(tab.key)}
              className={`flex items-center gap-2 px-4 py-2.5 text-sm font-medium whitespace-nowrap transition-all border-b-2 -mb-px ${
                activeTab === tab.key ? 'border-primary text-primary' : 'border-transparent text-muted-foreground hover:text-foreground'
              }`}
            >
              <Icon size={13} /> {tab.label}
            </button>
          );
        })}
      </div>

      {/* OVERVIEW */}
      {activeTab === 'overview' && (
        <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="space-y-6">

          {/* EYRA Goal Analysis */}
          {results.goal_analysis && (
            <div className="p-5 rounded-2xl border border-primary/20 bg-primary/5">
              <div className="flex items-center justify-between mb-3">
                <div className="flex items-center gap-2">
                  <EyraSectionLabel label="EYRA Analysis" />
                </div>
                <ConfidenceBadge level={overallConfidence} />
              </div>
              <p className="text-sm leading-relaxed text-foreground">{results.goal_analysis}</p>

              {/* Data summary */}
              {results.data_summary && (
                <div className="mt-4 pt-4 border-t border-primary/15 grid grid-cols-2 sm:grid-cols-4 gap-3">
                  {[
                    { label: 'Papers analysed', value: results.data_summary.total_papers },
                    { label: 'Researchers found', value: results.data_summary.total_researchers },
                    { label: 'Publication range', value: results.data_summary.date_range },
                    { label: 'Top cited author', value: results.data_summary.top_researcher || '—' },
                  ].map(s => (
                    <div key={s.label} className="text-center">
                      <p className="font-bold text-sm text-foreground">{s.value}</p>
                      <p className="text-[10px] text-muted-foreground mt-0.5">{s.label}</p>
                    </div>
                  ))}
                </div>
              )}
            </div>
          )}

          {/* Stats grid */}
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
            {[
              { label: 'Papers Found', value: results.papers?.length || 0, icon: FileText, color: 'text-primary bg-primary/10', tab: 'papers' },
              { label: 'Researchers', value: results.researchers?.length || 0, icon: Users, color: 'text-accent bg-accent/10', tab: 'researchers' },
              { label: 'Institutions', value: results.institutions?.length || 0, icon: Building2, color: 'text-chart-3 bg-chart-3/10', tab: 'institutions' },
              { label: 'Opportunities', value: results.funding_opportunities?.length || 0, icon: Award, color: 'text-chart-4 bg-chart-4/10', tab: 'funding' },
            ].map(s => {
              const Icon = s.icon;
              return (
                <button key={s.label} onClick={() => setActiveTab(s.tab)}
                  className="p-4 rounded-xl border border-border bg-card hover:border-primary/25 transition-colors text-left">
                  <div className={`w-7 h-7 rounded-lg ${s.color} flex items-center justify-center mb-2`}>
                    <Icon size={13} />
                  </div>
                  <div className="text-xl font-bold font-heading">{s.value}</div>
                  <div className="text-xs text-muted-foreground">{s.label}</div>
                </button>
              );
            })}
          </div>

          {/* Key Findings from real data */}
          {results.key_findings?.length > 0 && (
            <div>
              <h3 className="font-semibold text-sm mb-3 flex items-center gap-2">
                <ShieldCheck size={13} className="text-primary" />
                Key Findings from Real Data
              </h3>
              <div className="space-y-2">
                {results.key_findings.map((f, i) => (
                  <div key={i} className="p-4 rounded-xl border border-border bg-card">
                    <div className="flex items-start justify-between gap-2 mb-1">
                      <p className="text-sm text-foreground font-medium flex-1">{f.finding}</p>
                      <ConfidenceBadge level={f.confidence} />
                    </div>
                    <EvidenceNote text={f.evidence} />
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Top 3 papers */}
          {results.papers?.length > 0 && (
            <div>
              <div className="flex items-center justify-between mb-3">
                <h3 className="font-semibold text-sm">Top Research Papers</h3>
                <button onClick={() => setActiveTab('papers')} className="text-xs text-primary font-medium flex items-center gap-1 hover:underline">
                  View all <ChevronRight size={12} />
                </button>
              </div>
              <div className="space-y-3">
                {results.papers.slice(0, 3).map((p, i) => (
                  <PaperCard key={i} paper={p} onSave={() => savePaper(p)} rank={i + 1} />
                ))}
              </div>
            </div>
          )}

          {/* Research gaps */}
          {results.research_gaps?.length > 0 && (
            <div>
              <h3 className="font-semibold text-sm mb-3 flex items-center gap-2">
                <AlertTriangle size={13} className="text-amber-400" />
                Research Gaps Identified
                <span className="text-[10px] text-muted-foreground font-normal ml-1">from real literature analysis</span>
              </h3>
              <div className="space-y-2">
                {results.research_gaps.map((gap, i) => (
                  <div key={i} className="flex items-start gap-3 p-4 rounded-xl border border-border bg-card">
                    <div className="w-5 h-5 rounded-full bg-amber-500/15 text-amber-400 flex items-center justify-center text-[10px] font-bold flex-shrink-0 mt-0.5">{i + 1}</div>
                    <p className="text-sm text-muted-foreground leading-relaxed">{gap}</p>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Keywords */}
          {results.keywords?.length > 0 && (
            <div>
              <h3 className="font-semibold text-xs mb-3 text-muted-foreground uppercase tracking-wider">Research Keywords · Extracted from real papers</h3>
              <div className="flex flex-wrap gap-2">
                {results.keywords.map((kw, i) => (
                  <span key={i} className="px-3 py-1.5 rounded-full text-xs font-medium bg-secondary text-foreground border border-border/60">{kw}</span>
                ))}
              </div>
            </div>
          )}

          {/* CTA */}
          {!projectCreated && (
            <div className="p-5 rounded-2xl border border-primary/20 bg-primary/5 flex items-start gap-4">
              <div className="w-10 h-10 rounded-xl overflow-hidden bg-white flex-shrink-0">
                <img src="https://media.base44.com/images/public/6a3b660e73254d1b4bf55bcb/33f475246_image.png" alt="EYRA" className="w-full h-full object-contain" />
              </div>
              <div className="flex-1">
                <p className="font-semibold text-sm text-foreground mb-1">Turn this into a project workspace</p>
                <p className="text-xs text-muted-foreground mb-3">Save researchers, track progress, get EYRA's ongoing strategic guidance.</p>
                <button onClick={createProject} disabled={creatingProject}
                  className="flex items-center gap-2 px-4 py-2 rounded-xl eyra-gradient text-white text-xs font-semibold">
                  <Plus size={12} /> Create Project Workspace
                </button>
              </div>
            </div>
          )}
        </motion.div>
      )}

      {/* PAPERS */}
      {activeTab === 'papers' && (
        <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="space-y-3">
          <div className="flex items-center justify-between mb-2">
            <div>
              <h2 className="font-heading font-bold text-lg">Research Papers</h2>
              <p className="text-xs text-muted-foreground mt-0.5">Ranked by relevance + citation count + recency · Sources: OpenAlex, arXiv, Europe PMC</p>
            </div>
            <ConfidenceBadge level={overallConfidence} />
          </div>

          {results.papers?.length === 0 ? (
            <div className="p-8 rounded-xl border border-dashed border-border text-center">
              <FileText size={20} className="text-muted-foreground mx-auto mb-2" />
              <p className="text-sm text-muted-foreground">No papers found in databases for this query.</p>
              <p className="text-xs text-muted-foreground mt-1">Try a more specific search term.</p>
            </div>
          ) : (
            results.papers.map((p, i) => (
              <PaperCard key={i} paper={p} onSave={() => savePaper(p)} rank={i + 1} />
            ))
          )}
        </motion.div>
      )}

      {/* RESEARCHERS */}
      {activeTab === 'researchers' && (
        <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }}>
          <div className="flex items-center justify-between mb-4">
            <div>
              <EyraSectionLabel label="EYRA Researcher Intelligence" className="mb-1" />
              <p className="text-xs text-muted-foreground">{results.researchers?.length || 0} real experts found via OpenAlex · Recommended by EYRA</p>
            </div>
          </div>

          {results.researchers?.length === 0 ? (
            <div className="p-8 rounded-xl border border-dashed border-border text-center">
              <Users size={20} className="text-muted-foreground mx-auto mb-2" />
              <p className="text-sm text-muted-foreground">No researchers found for this exact query.</p>
              <Link to="/researchers" className="inline-flex items-center gap-1.5 mt-3 text-xs text-primary font-medium hover:underline">
                <Sparkles size={11} /> Try the Researcher Discovery tool
              </Link>
            </div>
          ) : (
            <div className="grid gap-3 sm:grid-cols-2">
              {results.researchers.map((r, i) => (
                <ResearcherCard key={i} researcher={r} onSave={() => saveResearcher(r)} />
              ))}
            </div>
          )}

          {/* AI-suggested roles — clearly labelled as AI */}
          {results.suggested_roles?.length > 0 && (
            <div className="mt-8">
              <EyraSectionLabel label="EYRA Collaboration Suggestions" className="mb-1" />
              <p className="text-[11px] text-muted-foreground mb-3">Based on gaps identified in the real researcher data above</p>
              <div className="grid gap-3 sm:grid-cols-2">
                {results.suggested_roles.map((role, i) => (
                  <div key={i} className="p-4 rounded-xl border border-border bg-card">
                    <h4 className="font-semibold text-sm mb-1">{role.role}</h4>
                    <p className="text-xs text-muted-foreground mb-1"><span className="font-medium text-foreground">Expertise:</span> {role.expertise}</p>
                    <p className="text-xs text-muted-foreground mb-2">{role.why_needed}</p>
                    {role.evidence && <EvidenceNote text={role.evidence} />}
                  </div>
                ))}
              </div>
            </div>
          )}
        </motion.div>
      )}

      {/* INSTITUTIONS */}
      {activeTab === 'institutions' && (
        <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }}>
          <div className="mb-4">
            <h2 className="font-heading font-bold text-lg">Institutions</h2>
            <p className="text-xs text-muted-foreground mt-0.5">Real institutions from OpenAlex database</p>
          </div>
          {results.institutions?.length === 0 ? (
            <div className="p-8 rounded-xl border border-dashed border-border text-center">
              <Building2 size={20} className="text-muted-foreground mx-auto mb-2" />
              <p className="text-sm text-muted-foreground">No institutions found for this topic.</p>
            </div>
          ) : (
            <div className="grid gap-3 sm:grid-cols-2">
              {results.institutions.map((inst, i) => (
                <div key={i} className="p-5 rounded-xl border border-border bg-card hover:border-primary/25 transition-colors card-glow">
                  <div className="flex items-start justify-between">
                    <div>
                      <h4 className="font-semibold text-sm">{inst.name}</h4>
                      <p className="text-xs text-muted-foreground mt-0.5 capitalize">{inst.type}{inst.country && ` · ${inst.country}`}</p>
                    </div>
                    {inst.url && (
                      <a href={inst.url} target="_blank" rel="noopener noreferrer" className="p-2 rounded-lg hover:bg-secondary transition-colors">
                        <ExternalLink size={13} className="text-muted-foreground" />
                      </a>
                    )}
                  </div>
                  <div className="flex items-center gap-4 mt-3 text-xs text-muted-foreground">
                    <span>{(inst.works_count || 0).toLocaleString()} works</span>
                    <span>{(inst.cited_by_count || 0).toLocaleString()} citations</span>
                  </div>
                </div>
              ))}
            </div>
          )}
        </motion.div>
      )}

      {/* ROADMAP */}
      {activeTab === 'roadmap' && (
        <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }}>
          <div className="mb-6">
            <EyraSectionLabel label="EYRA Action Roadmap" className="mb-1" />
            <p className="text-xs text-muted-foreground">Generated by EYRA · Analyzed from {results.papers?.length || 0} real papers</p>
          </div>
          {results.roadmap?.length === 0 ? (
            <div className="p-8 rounded-xl border border-dashed border-border text-center">
              <Map size={20} className="text-muted-foreground mx-auto mb-2" />
              <p className="text-sm text-muted-foreground">Create a project to generate a detailed personalized roadmap.</p>
            </div>
          ) : (
            <div className="space-y-0">
              {results.roadmap.map((step, i) => (
                <div key={i} className="flex gap-4">
                  <div className="flex flex-col items-center">
                    <div className="w-9 h-9 rounded-full eyra-gradient flex items-center justify-center text-white text-sm font-bold flex-shrink-0">{i + 1}</div>
                    {i < results.roadmap.length - 1 && <div className="w-px flex-1 bg-border my-1" />}
                  </div>
                  <div className="pb-8 flex-1">
                    <div className="text-xs font-semibold text-primary mb-1 uppercase tracking-wider">{step.timeframe}</div>
                    <h4 className="font-semibold text-sm mb-2 text-foreground">{step.title}</h4>
                    <ul className="space-y-1.5">
                      {step.tasks?.map((task, j) => (
                        <li key={j} className="text-sm text-muted-foreground flex items-start gap-2">
                          <CheckCircle2 size={12} className="text-primary/50 mt-0.5 flex-shrink-0" />
                          {task}
                        </li>
                      ))}
                    </ul>
                  </div>
                </div>
              ))}
            </div>
          )}
        </motion.div>
      )}

      {/* FUNDING */}
      {activeTab === 'funding' && (
        <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }}>
          <div className="flex items-center justify-between mb-5">
            <div>
              <EyraSectionLabel label="EYRA Funding Intelligence" className="mb-1" />
              <p className="text-xs text-muted-foreground">Real programs matched to your research area — always verify on official sources</p>
            </div>
            <Link to="/radar" className="flex items-center gap-1.5 text-xs text-primary font-medium hover:underline">
              <Sparkles size={11} /> Run full Radar
            </Link>
          </div>

          {/* Trends from real papers */}
          {results.trends?.length > 0 && (
            <div className="mb-6">
              <h3 className="font-semibold text-xs uppercase tracking-wider text-muted-foreground mb-3">Emerging Trends · From real paper analysis</h3>
              <div className="grid gap-3 sm:grid-cols-2">
                {results.trends.map((t, i) => (
                  <div key={i} className="p-4 rounded-xl border border-border bg-card">
                    <div className="flex items-center gap-2 mb-1.5">
                      <TrendingUp size={12} className="text-green-400" />
                      <h4 className="font-semibold text-sm">{t.title}</h4>
                      {t.year_range && <span className="text-[10px] text-muted-foreground ml-auto">{t.year_range}</span>}
                    </div>
                    <p className="text-xs text-muted-foreground leading-relaxed">{t.description}</p>
                    {t.evidence && <EvidenceNote text={`Evidence: ${t.evidence}`} />}
                  </div>
                ))}
              </div>
            </div>
          )}

          {results.funding_opportunities?.length === 0 ? (
            <div className="p-8 rounded-xl border border-dashed border-border text-center">
              <Award size={20} className="text-muted-foreground mx-auto mb-2" />
              <p className="text-sm text-muted-foreground">No opportunities matched. Try the Opportunity Radar for deeper results.</p>
              <Link to="/radar" className="inline-flex items-center gap-1.5 mt-3 px-4 py-2 rounded-xl eyra-gradient text-white text-xs font-semibold">
                <Sparkles size={11} /> Run Opportunity Radar
              </Link>
            </div>
          ) : (
            <div className="space-y-3">
              {results.funding_opportunities.map((f, i) => {
                const typeColors = {
                  grant: 'bg-primary/15 text-primary',
                  competition: 'bg-amber-500/15 text-amber-400',
                  accelerator: 'bg-green-500/15 text-green-400',
                  scholarship: 'bg-accent/15 text-accent',
                };
                return (
                  <div key={i} className="p-5 rounded-xl border border-border bg-card">
                    <div className="flex items-start justify-between gap-3">
                      <div className="flex-1">
                        <div className="flex items-center gap-2 mb-2 flex-wrap">
                          <span className={`px-2 py-0.5 rounded-full text-[10px] font-semibold uppercase ${typeColors[f.type] || 'bg-secondary text-foreground'}`}>{f.type}</span>
                          {f.source && <span className="text-[10px] text-muted-foreground">via {f.source}</span>}
                        </div>
                        <h4 className="font-semibold text-sm mb-1">{f.title}</h4>
                        <p className="text-xs text-muted-foreground leading-relaxed mb-2">{f.description}</p>
                        {f.match_reason && (
                          <div className="flex items-start gap-1.5">
                            <ShieldCheck size={10} className="text-primary flex-shrink-0 mt-0.5" />
                            <p className="text-[11px] text-primary italic">{f.match_reason}</p>
                          </div>
                        )}
                        <div className="flex items-center gap-2 mt-3 flex-wrap">
                          {f.url && (
                            <a href={f.url} target="_blank" rel="noopener noreferrer"
                              className="inline-flex items-center gap-1 text-[11px] text-primary font-medium hover:underline">
                              <ExternalLink size={10} /> Open Grant Page
                            </a>
                          )}
                          {f.source && <span className="text-[10px] text-muted-foreground">Source: {f.source}</span>}
                        </div>
                      </div>
                      <button
                        onClick={async () => {
                          await base44.entities.SavedOpportunity.create({ title: f.title, type: f.type, description: f.description, source: f.source, url: f.url });
                          toast({ title: 'Opportunity saved' });
                        }}
                        className="p-2 rounded-lg hover:bg-secondary transition-colors flex-shrink-0"
                      >
                        <Bookmark size={14} className="text-muted-foreground" />
                      </button>
                    </div>
                  </div>
                );
              })}
              <p className="text-[11px] text-muted-foreground text-center pt-2">
                ⚠ Always verify funding opportunities on official program websites before applying.
              </p>
            </div>
          )}
        </motion.div>
      )}
    </div>
  );
}

function PaperCard({ paper, onSave, rank }) {
  const getImpactLevel = (cited) => {
    if (cited > 500) return { label: 'Highly cited', color: 'text-primary bg-primary/10' };
    if (cited > 100) return { label: 'Well cited', color: 'text-green-400 bg-green-500/10' };
    if (cited > 10) return { label: 'Cited', color: 'text-muted-foreground bg-secondary' };
    return null;
  };
  const impact = paper.cited_by_count > 0 ? getImpactLevel(paper.cited_by_count) : null;

  return (
    <div className="p-5 rounded-xl border border-border bg-card hover:border-primary/25 transition-colors card-glow group">
      <div className="flex items-start justify-between gap-3">
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2 mb-1.5 flex-wrap">
            {paper.source && (
              <span className="px-2 py-0.5 rounded-full text-[10px] font-semibold bg-secondary text-muted-foreground uppercase">{paper.source}</span>
            )}
            {paper.year && <span className="text-xs text-muted-foreground">{paper.year}</span>}
            {paper.cited_by_count > 0 && (
              <span className="text-[10px] text-muted-foreground">{paper.cited_by_count.toLocaleString()} citations</span>
            )}
            {impact && (
              <span className={`px-2 py-0.5 rounded-full text-[10px] font-semibold ${impact.color}`}>{impact.label}</span>
            )}
            {paper.open_access && (
              <span className="text-[10px] text-green-400">Open Access</span>
            )}
          </div>
          <h4 className="font-semibold text-sm leading-snug mb-1.5 text-foreground">{paper.title}</h4>
          {paper.authors && <p className="text-xs text-muted-foreground mb-2">{paper.authors}</p>}
          {paper.summary && <p className="text-xs text-muted-foreground/80 leading-relaxed line-clamp-2">{paper.summary}</p>}
        </div>
        <div className="flex flex-col gap-1 flex-shrink-0">
          <button onClick={onSave} className="p-2 rounded-lg hover:bg-secondary transition-colors" title="Save to library">
            <Bookmark size={13} className="text-muted-foreground" />
          </button>
          {paper.url && (
            <a href={paper.url} target="_blank" rel="noopener noreferrer" className="p-2 rounded-lg hover:bg-secondary transition-colors">
              <ExternalLink size={13} className="text-muted-foreground" />
            </a>
          )}
        </div>
      </div>
    </div>
  );
}

function ResearcherCard({ researcher, onSave }) {
  return (
    <div className="p-5 rounded-xl border border-border bg-card hover:border-primary/25 transition-colors card-glow">
      <div className="flex items-start justify-between gap-3">
        <div className="flex-1 min-w-0">
          <h4 className="font-semibold text-sm text-foreground">{researcher.name}</h4>
          <p className="text-xs text-muted-foreground mt-0.5">{researcher.institution}</p>
          {researcher.country && <p className="text-[10px] text-muted-foreground/70">{researcher.country}</p>}
          {researcher.research_areas && (
            <p className="text-xs text-muted-foreground/70 mt-1.5 line-clamp-2">{researcher.research_areas}</p>
          )}
          <div className="flex items-center gap-4 mt-3 text-xs text-muted-foreground">
            <span><BookOpen size={11} className="inline mr-1" />{(researcher.works_count || 0).toLocaleString()} works</span>
            <span>{(researcher.citation_count || 0).toLocaleString()} citations</span>
          </div>
          <p className="text-[9px] text-muted-foreground/50 mt-2 flex items-center gap-1">
            <ShieldCheck size={8} /> Source: OpenAlex · Recommended by EYRA
          </p>
        </div>
        <div className="flex flex-col gap-1 flex-shrink-0">
          <button onClick={onSave} className="p-2 rounded-lg hover:bg-secondary transition-colors" title="Save">
            <Bookmark size={13} className="text-muted-foreground" />
          </button>
          {researcher.profile_url && (
            <a href={researcher.profile_url} target="_blank" rel="noopener noreferrer" className="p-2 rounded-lg hover:bg-secondary transition-colors">
              <ExternalLink size={13} className="text-muted-foreground" />
            </a>
          )}
        </div>
      </div>
    </div>
  );
}
