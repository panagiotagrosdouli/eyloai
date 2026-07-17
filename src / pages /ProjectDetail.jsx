import React, { useState, useEffect } from 'react';
import { useParams, Link } from 'react-router-dom';
import { base44 } from '@/api/base44Client';
import {
  ArrowLeft, Sparkles, Save, Loader2, FileText, Users,
  Award, StickyNote, Brain, TrendingUp, Clock, Video,
  Target, CheckCircle2, AlertTriangle, Zap, RefreshCw
} from 'lucide-react';
import ProjectMeetings from '@/components/meetings/ProjectMeetings';
import { motion } from 'framer-motion';
import { useToast } from '@/components/ui/use-toast';
import ReactMarkdown from 'react-markdown';
import moment from 'moment';
import StartupBuilder from '@/components/projects/StartupBuilder';
import EyraProjectTwin from '@/components/eyra/EyraProjectTwin';
import ProjectHeaalthScore from '@/components/projects/ProjectHealthScore';
import { EyraSectionLabel } from '@/components/eyra/EyraBadge';

const TABS = [
  { key: 'overview', label: 'Overview', icon: Target },
  { key: 'notes', label: 'Notes & Tasks', icon: StickyNote },
  { key: 'meetings', label: 'Meetings', icon: Video },
  { key: 'intelligence', label: 'EYRA Intelligence', icon: Brain },
];

const STATUS_OPTIONS = ['planning', 'active', 'paused', 'completed'];
const STATUS_COLORS = {
  planning: 'bg-secondary text-muted-foreground',
  active: 'bg-green-500/15 text-green-400',
  paused: 'bg-amber-500/15 text-amber-400',
  completed: 'bg-primary/15 text-primary',
};

export default function ProjectDetail() {
  const { id } = useParams();
  const [project, setProject] = useState(null);
  const [loading, setLoading] = useState(true);
  const [analyzing, setAnalyzing] = useState(false);
  const [saving, setSaving] = useState(false);
  const [activeTab, setActiveTab] = useState('overview');
  const [editing, setEditing] = useState({});
  const [savedPapers, setSavedPapers] = useState([]);
  const [savedResearchers, setSavedResearchers] = useState([]);
  const [meetings, setMeetings] = useState([]);
  const { toast } = useToast();

  useEffect(() => { loadAll(); }, [id]);

  const loadAll = async () => {
    setLoading(true);
    const [data, papers, researchers, mtgs] = await Promise.all([
      base44.entities.Project.get(id),
      base44.entities.SavedPaper.list('-created_date', 100),
      base44.entities.SavedResearcher.list('-created_date', 100),
      base44.entities.Meeting.filter({ project_id: id }, '-date', 20),
    ]);
    setProject(data);
    setSavedPapers(papers);
    setSavedResearchers(researchers);
    setMeetings(mtgs);
    setEditing({
      title: data.title || '',
      goal: data.goal || '',
      description: data.description || '',
      milestones: data.milestones || '',
      tasks: data.tasks || '',
      notes: data.notes || '',
      status: data.status || 'planning',
    });
    setLoading(false);
  };

  const saveProject = async () => {
    setSaving(true);
    await base44.entities.Project.update(id, editing);
    setSaving(false);
    toast({ title: 'Project saved' });
  };

  const runEyraAnalysis = async () => {
    setAnalyzing(true);
    const result = await base44.integrations.Core.InvokeLLM({
      prompt: `You are EYRA, an AI Research & Innovation Co-Founder. Analyze this project and provide structured intelligence.

Project: ${editing.title}
Goal: ${editing.goal}
Description: ${editing.description || 'Not provided'}
Milestones: ${editing.milestones || 'None set'}
Saved Papers: ${savedPapers.length} papers in library
Saved Researchers: ${savedResearchers.length} researchers saved
Meetings scheduled: ${meetings.length}

Provide a comprehensive analysis in markdown format:

## Research Gap Analysis
What key research gaps exist? What unexplored angles could lead to publication or breakthrough?

## Missing Skills & Collaborators
What expertise is missing? What specific roles should be recruited?

## Funding Keywords & Opportunities
Keywords for finding grants. Top 3 specific funding programs to apply to.

## Priority Next Steps
3-5 concrete immediate actions (this week)

## Risk Assessment
Top 3 risks and how to mitigate them

## Recommended Research Directions
3-5 specific research directions or papers to explore next

Be specific, actionable, and research-oriented. Format clearly with bullet points.`,
    });
    await base44.entities.Project.update(id, { eyra_analysis: result });
    setProject(prev => ({ ...prev, eyra_analysis: result }));
    setAnalyzing(false);
    setActiveTab('intelligence');
    toast({ title: 'EYRA analysis complete' });
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-[60vh]">
        <div className="w-6 h-6 border-2 border-border border-t-primary rounded-full animate-spin" />
      </div>
    );
  }

  if (!project) {
    return (
      <div className="max-w-3xl mx-auto px-4 py-20 text-center">
        <p className="text-muted-foreground">Project not found</p>
        <Link to="/projects" className="text-sm text-primary hover:underline mt-2 inline-block">Back to projects</Link>
      </div>
    );
  }

  const statusColor = STATUS_COLORS[editing.status] || STATUS_COLORS.planning;
  const upcomingMeetings = meetings.filter(m => moment(m.date).isSameOrAfter(moment(), 'day'));
  const twinReport = project.twin_report ? (() => { try { return JSON.parse(project.twin_report); } catch { return null; } })() : null;

  return (
    <div className="max-w-4xl mx-auto px-4 py-8">
      <Link to="/projects" className="inline-flex items-center gap-2 text-xs text-muted-foreground hover:text-foreground transition-colors mb-6 group">
        <ArrowLeft size={14} className="group-hover:-translate-x-0.5 transition-transform" />
        Back to projects
      </Link>

      {/* Header */}
      <div className="flex items-start justify-between gap-4 mb-6">
        <div className="flex-1">
          <input
            type="text"
            value={editing.title}
            onChange={e => setEditing(prev => ({ ...prev, title: e.target.value }))}
            className="w-full text-2xl sm:text-3xl font-heading font-bold bg-transparent border-none outline-none text-foreground placeholder:text-muted-foreground"
            placeholder="Project title"
          />
          <div className="flex items-center gap-3 mt-2">
            <select
              value={editing.status}
              onChange={e => setEditing(prev => ({ ...prev, status: e.target.value }))}
              className={`text-xs font-semibold px-3 py-1 rounded-full border-0 focus:outline-none focus:ring-1 focus:ring-primary/40 ${statusColor}`}
            >
              {STATUS_OPTIONS.map(s => (
                <option key={s} value={s}>{s.charAt(0).toUpperCase() + s.slice(1)}</option>
              ))}
            </select>
            <span className="text-xs text-muted-foreground flex items-center gap-1">
              <Clock size={10} /> Updated {moment(project.updated_date).fromNow()}
            </span>
          </div>
        </div>
        <div className="flex items-center gap-2">
          <button
            onClick={runEyraAnalysis}
            disabled={analyzing}
            className="flex items-center gap-2 px-4 py-2.5 rounded-xl eyra-gradient text-white text-sm font-semibold disabled:opacity-60 hover:opacity-90 transition-opacity"
          >
            {analyzing ? <Loader2 size={13} className="animate-spin" /> : <Sparkles size={13} />}
            {analyzing ? 'Analyzing...' : 'Run EYRA'}
          </button>
          <button
            onClick={saveProject}
            disabled={saving}
            className="flex items-center gap-2 px-4 py-2.5 rounded-xl border border-border bg-card text-sm font-medium hover:bg-secondary transition-colors"
          >
            {saving ? <Loader2 size={13} className="animate-spin" /> : <Save size={13} />}
            Save
          </button>
        </div>
      </div>

      {/* Tabs */}
      <div className="flex items-center gap-1 border-b border-border/60 mb-6 overflow-x-auto">
        {TABS.map(tab => {
          const Icon = tab.icon;
          return (
            <button
              key={tab.key}
              onClick={() => setActiveTab(tab.key)}
              className={`flex items-center gap-2 px-4 py-2.5 text-sm font-medium transition-all border-b-2 -mb-px whitespace-nowrap ${
                activeTab === tab.key
                  ? 'border-primary text-primary'
                  : 'border-transparent text-muted-foreground hover:text-foreground'
              }`}
            >
              <Icon size={13} />
              {tab.label}
              {tab.key === 'intelligence' && project.eyra_analysis && (
                <span className="w-1.5 h-1.5 rounded-full bg-primary ml-1" />
              )}
              {tab.key === 'meetings' && upcomingMeetings.length > 0 && (
                <span className="text-[10px] px-1.5 py-0.5 rounded-full bg-primary/15 text-primary font-semibold ml-1">{upcomingMeetings.length}</span>
              )}
            </button>
          );
        })}
      </div>

      {/* Overview */}
      {activeTab === 'overview' && (
        <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="space-y-5">

          {/* EYRA Next Action banner */}
          <div className="p-4 rounded-xl border border-primary/25 bg-primary/5 flex items-start gap-3">
            <div className="w-8 h-8 rounded-lg overflow-hidden bg-white flex-shrink-0">
              <img src="https://media.base44.com/images/public/6a3b660e73254d1b4bf55bcb/33f475246_image.png" alt="EYRA" className="w-full h-full object-contain" />
            </div>
            <div className="flex-1">
              <p className="text-[10px] font-bold uppercase tracking-widest text-primary mb-0.5">EYRA recommends</p>
              {!project.eyra_analysis ? (
                <>
                  <p className="text-xs font-semibold text-foreground mb-1">Run EYRA Analysis to unlock intelligence</p>
                  <p className="text-[10px] text-muted-foreground mb-2">Identify research gaps, find collaborators, discover funding, and get a strategic roadmap.</p>
                  <button onClick={runEyraAnalysis} disabled={analyzing}
                    className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg eyra-gradient text-white text-xs font-semibold">
                    {analyzing ? <Loader2 size={10} className="animate-spin" /> : <Sparkles size={10} />}
                    {analyzing ? 'Analyzing...' : 'Run EYRA Analysis'}
                  </button>
                </>
              ) : twinReport ? (
                <>
                  <p className="text-xs font-semibold text-foreground mb-1">{twinReport.next_action}</p>
                  <p className="text-[10px] text-muted-foreground mb-2">Project health: <span className={twinReport.overall_health === 'Strong' || twinReport.overall_health === 'Good' ? 'text-green-400' : 'text-amber-400'}>{twinReport.overall_health} · {twinReport.health_score}/100</span></p>
                  <div className="flex flex-wrap gap-2">
                    {[
                      { label: 'View full intelligence', key: 'intelligence' },
                      { label: 'Schedule meeting', key: 'meetings' },
                    ].map(item => (
                      <button key={item.key} onClick={() => setActiveTab(item.key)}
                        className="px-3 py-1 rounded-lg bg-primary/10 border border-primary/20 text-xs font-medium text-primary hover:bg-primary/20 transition-colors">
                        {item.label} →
                      </button>
                    ))}
                  </div>
                </>
              ) : (
                <>
                  <p className="text-xs font-semibold text-foreground mb-2">What to do next:</p>
                  <div className="flex flex-wrap gap-2">
                    {[
                      { label: 'View EYRA insights', key: 'intelligence' },
                      { label: 'Schedule a meeting', key: 'meetings' },
                    ].map(item => (
                      <button key={item.key} onClick={() => setActiveTab(item.key)}
                        className="px-3 py-1 rounded-lg bg-primary/10 border border-primary/20 text-xs font-medium text-primary hover:bg-primary/20 transition-colors">
                        {item.label} →
                      </button>
                    ))}
                  </div>
                </>
              )}
            </div>
          </div>

          {/* Project Stats */}
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
            {[
              { label: 'Papers Saved', value: savedPapers.length, icon: FileText, color: 'text-primary bg-primary/10' },
              { label: 'Researchers', value: savedResearchers.length, icon: Users, color: 'text-accent bg-accent/10' },
              { label: 'Meetings', value: meetings.length, icon: Video, color: 'text-chart-3 bg-chart-3/10' },
              { label: 'Upcoming', value: upcomingMeetings.length, icon: Clock, color: 'text-green-400 bg-green-500/10' },
            ].map(s => {
              const Icon = s.icon;
              return (
                <div key={s.label} className="p-3.5 rounded-xl border border-border bg-card">
                  <div className={`w-7 h-7 rounded-lg ${s.color} flex items-center justify-center mb-2`}>
                    <Icon size={13} />
                  </div>
                  <p className="text-xl font-bold font-heading">{s.value}</p>
                  <p className="text-[10px] text-muted-foreground">{s.label}</p>
                </div>
              );
            })}
          </div>

          {/* Goal */}
          <div>
            <label className="block text-xs font-semibold text-muted-foreground uppercase tracking-wider mb-2">Goal</label>
            <textarea
              value={editing.goal}
              onChange={e => setEditing(prev => ({ ...prev, goal: e.target.value }))}
              rows={2}
              className="w-full px-4 py-3 rounded-xl border border-border bg-card text-sm text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-1 focus:ring-primary/40 focus:border-primary/40 resize-none"
            />
          </div>
          <div>
            <label className="block text-xs font-semibold text-muted-foreground uppercase tracking-wider mb-2">Description</label>
            <textarea
              value={editing.description}
              onChange={e => setEditing(prev => ({ ...prev, description: e.target.value }))}
              rows={4}
              placeholder="Describe your project in detail..."
              className="w-full px-4 py-3 rounded-xl border border-border bg-card text-sm text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-1 focus:ring-primary/40 focus:border-primary/40 resize-none"
            />
          </div>
          <div>
            <label className="block text-xs font-semibold text-muted-foreground uppercase tracking-wider mb-2">Milestones</label>
            <textarea
              value={editing.milestones}
              onChange={e => setEditing(prev => ({ ...prev, milestones: e.target.value }))}
              rows={4}
              placeholder="List your key milestones, one per line..."
              className="w-full px-4 py-3 rounded-xl border border-border bg-card text-sm text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-1 focus:ring-primary/40 focus:border-primary/40 resize-none"
            />
          </div>

          <StartupBuilder project={editing} />

          <div className="flex justify-end">
            <button onClick={saveProject} disabled={saving}
              className="flex items-center gap-2 px-5 py-2.5 rounded-xl eyra-gradient text-white text-sm font-semibold disabled:opacity-60">
              {saving ? <Loader2 size={13} className="animate-spin" /> : <Save size={13} />}
              {saving ? 'Saving...' : 'Save Changes'}
            </button>
          </div>
        </motion.div>
      )}

      {/* Notes & Tasks */}
      {activeTab === 'notes' && (
        <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="space-y-5">
          <div>
            <label className="block text-xs font-semibold text-muted-foreground uppercase tracking-wider mb-2">Tasks</label>
            <textarea
              value={editing.tasks}
              onChange={e => setEditing(prev => ({ ...prev, tasks: e.target.value }))}
              rows={6}
              placeholder="List your current tasks, one per line..."
              className="w-full px-4 py-3 rounded-xl border border-border bg-card text-sm text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-1 focus:ring-primary/40 focus:border-primary/40 resize-none"
            />
          </div>
          <div>
            <label className="block text-xs font-semibold text-muted-foreground uppercase tracking-wider mb-2">Notes</label>
            <textarea
              value={editing.notes}
              onChange={e => setEditing(prev => ({ ...prev, notes: e.target.value }))}
              rows={8}
              placeholder="Add notes, ideas, references, observations..."
              className="w-full px-4 py-3 rounded-xl border border-border bg-card text-sm text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-1 focus:ring-primary/40 focus:border-primary/40 resize-none"
            />
          </div>
          <button onClick={saveProject} disabled={saving} className="px-5 py-2.5 rounded-xl eyra-gradient text-white text-sm font-semibold">
            {saving ? 'Saving...' : 'Save'}
          </button>
        </motion.div>
      )}

      {/* Meetings */}
      {activeTab === 'meetings' && (
        <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }}>
          <ProjectMeetings projectId={id} projectTitle={editing.title} />
        </motion.div>
      )}

      {/* Intelligence — EYRA Analysis + Digital Twin combined */}
      {activeTab === 'intelligence' && (
        <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="space-y-6">

          {/* EYRA Analysis */}
          <div>
            <div className="flex items-center justify-between mb-4">
              <EyraSectionLabel label="EYRA Project Intelligence" />
              <button onClick={runEyraAnalysis} disabled={analyzing} className="flex items-center gap-1.5 text-xs text-primary font-medium hover:underline">
                {analyzing ? <Loader2 size={10} className="animate-spin" /> : <RefreshCw size={10} />}
                {analyzing ? 'Analyzing...' : project.eyra_analysis ? 'Regenerate' : 'Run Analysis'}
              </button>
            </div>

            {project.eyra_analysis ? (
              <div className="p-5 rounded-2xl border border-primary/20 bg-primary/5">
                <div className="prose prose-sm max-w-none text-sm prose-headings:text-foreground prose-headings:font-semibold prose-p:text-muted-foreground prose-li:text-muted-foreground prose-strong:text-foreground">
                  <ReactMarkdown>{project.eyra_analysis}</ReactMarkdown>
                </div>
              </div>
            ) : (
              <div className="flex flex-col items-center justify-center py-12 text-center border border-dashed border-border rounded-2xl">
                <div className="w-14 h-14 rounded-2xl eyra-gradient flex items-center justify-center mb-4 animate-pulse-glow">
                  <Brain size={22} className="text-white" />
                </div>
                <h3 className="font-heading font-semibold mb-1 text-sm">No analysis yet</h3>
                <p className="text-xs text-muted-foreground max-w-xs mb-4">
                  EYRA will identify research gaps, suggest collaborators, map funding, and give you concrete next steps.
                </p>
                <button onClick={runEyraAnalysis} disabled={analyzing}
                  className="flex items-center gap-2 px-5 py-2.5 rounded-xl eyra-gradient text-white text-sm font-semibold">
                  {analyzing ? <Loader2 size={13} className="animate-spin" /> : <Sparkles size={13} />}
                  {analyzing ? 'Analyzing...' : 'Run EYRA Analysis'}
                </button>
              </div>
            )}
          </div>

          {/* Project Health Score */}
          <ProjectHealthScore
            project={project}
            savedPapers={savedPapers}
            savedResearchers={savedResearchers}
            meetings={meetings}
          />

          {/* Digital Twin — integrated below analysis */}
          <div className="border-t border-border/60 pt-6">
            <div className="flex items-center gap-2 mb-1">
              <EyraSectionLabel label="EYRA Project Twin" />
              <span className="text-[10px] px-2 py-0.5 rounded-full bg-green-500/15 text-green-400 font-medium">Live Monitor</span>
            </div>
            <p className="text-xs text-muted-foreground mb-4">Monitoring continuously · Discovered by EYRA</p>
            <EyraProjectTwin project={project} />
          </div>
        </motion.div>
      )}
    </div>
  );
}
