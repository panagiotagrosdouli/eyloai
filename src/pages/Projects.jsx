import React, { useState, useEffect } from 'react';
import { base44 } from '@/api/base44Client';
import { Link } from 'react-router-dom';
import {
  Plus, FolderOpen, ChevronRight, Trash2, Sparkles,
  Clock, X, ArrowRight, LayoutTemplate
} from 'lucide-react';
import ProjectTemplates from '@/components/projects/ProjectTemplates';
import { motion, AnimatePresence } from 'framer-motion';
import { useToast } from '@/components/ui/use-toast';
import moment from 'moment';

const STATUS_CONFIG = {
  planning: { label: 'Planning', color: 'bg-secondary text-muted-foreground' },
  active: { label: 'Active', color: 'bg-green-500/15 text-green-400' },
  paused: { label: 'Paused', color: 'bg-amber-500/15 text-amber-400' },
  completed: { label: 'Completed', color: 'bg-primary/15 text-primary' },
};

const FILTERS = [
  { key: 'all', label: 'All' },
  { key: 'active', label: 'Active' },
  { key: 'planning', label: 'Planning' },
  { key: 'paused', label: 'Paused' },
  { key: 'completed', label: 'Completed' },
];

export default function Projects() {
  const [projects, setProjects] = useState([]);
  const [loading, setLoading] = useState(true);
  const [showNew, setShowNew] = useState(false);
  const [showTemplates, setShowTemplates] = useState(true);
  const [newTitle, setNewTitle] = useState('');
  const [newGoal, setNewGoal] = useState('');
  const [newMilestones, setNewMilestones] = useState('');
  const [newTasks, setNewTasks] = useState('');
  const [selectedTemplate, setSelectedTemplate] = useState(null);
  const [filterStatus, setFilterStatus] = useState('all');
  const { toast } = useToast();

  useEffect(() => { loadProjects(); }, []);

  const loadProjects = async () => {
    setLoading(true);
    const data = await base44.entities.Project.list('-updated_date');
    setProjects(data);
    setLoading(false);
  };

  const createProject = async () => {
    if (!newTitle.trim() || !newGoal.trim()) return;
    await base44.entities.Project.create({
      title: newTitle.trim(),
      goal: newGoal.trim(),
      milestones: newMilestones.trim(),
      tasks: newTasks.trim(),
      status: 'active',
    });
    setNewTitle(''); setNewGoal(''); setNewMilestones(''); setNewTasks('');
    setSelectedTemplate(null); setShowTemplates(true); setShowNew(false);
    loadProjects();
    toast({ title: 'Project created — EYRA is ready to guide you' });
  };

  const applyTemplate = (t) => {
    setSelectedTemplate(t);
    setNewGoal(t.goal);
    setNewMilestones(t.milestones);
    setNewTasks(t.tasks);
    setShowTemplates(false);
  };

  const resetForm = () => {
    setShowNew(false);
    setSelectedTemplate(null);
    setShowTemplates(true);
    setNewTitle(''); setNewGoal(''); setNewMilestones(''); setNewTasks('');
  };

  const deleteProject = async (id, e) => {
    e.preventDefault();
    e.stopPropagation();
    await base44.entities.Project.delete(id);
    setProjects(prev => prev.filter(p => p.id !== id));
    toast({ title: 'Project deleted' });
  };

  const counts = { all: projects.length };
  FILTERS.slice(1).forEach(f => {
    counts[f.key] = projects.filter(p => (p.status || 'planning') === f.key).length;
  });
  const filtered = filterStatus === 'all' ? projects : projects.filter(p => (p.status || 'planning') === filterStatus);

  return (
    <div className="max-w-4xl mx-auto px-4 py-10">

      {/* Header */}
      <div className="flex items-start justify-between gap-4 mb-8">
        <div>
          <h1 className="font-heading font-bold text-2xl sm:text-3xl text-foreground mb-1">Projects</h1>
          <p className="text-muted-foreground text-sm">Each project is your EYRA-powered research command center.</p>
        </div>
        <button
          onClick={() => setShowNew(true)}
          className="flex items-center gap-2 px-4 py-2.5 rounded-xl eyra-gradient text-white text-sm font-semibold hover:opacity-90 transition-opacity flex-shrink-0"
        >
          <Plus size={14} /> New Project
        </button>
      </div>

      {/* New Project Form */}
      <AnimatePresence>
        {showNew && (
          <motion.div
            initial={{ opacity: 0, y: -8 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -8 }}
            className="mb-6 p-6 rounded-2xl border border-primary/20 bg-primary/5"
          >
            <div className="flex items-center justify-between mb-4">
              <h3 className="font-semibold text-sm flex items-center gap-2">
                <Sparkles size={14} className="text-primary" />
                Create a new project
              </h3>
              <button onClick={resetForm} className="p-1.5 rounded-lg hover:bg-secondary transition-colors">
                <X size={14} className="text-muted-foreground" />
              </button>
            </div>

            {/* Template picker */}
            {showTemplates && (
              <ProjectTemplates onSelect={applyTemplate} onClose={() => setShowTemplates(false)} />
            )}

            {/* Selected template badge */}
            {selectedTemplate && !showTemplates && (
              <div className="flex items-center gap-2 mb-4 px-3 py-2 rounded-xl border border-border bg-secondary/40">
                <LayoutTemplate size={12} className="text-primary" />
                <span className="text-xs font-medium text-foreground">Template: {selectedTemplate.label}</span>
                <button onClick={() => setShowTemplates(true)} className="ml-auto text-[10px] text-primary hover:underline">Change</button>
              </div>
            )}

            <div className="space-y-3">
              <input
                type="text"
                value={newTitle}
                onChange={e => setNewTitle(e.target.value)}
                placeholder="Project title"
                autoFocus
                className="w-full h-11 px-4 rounded-xl border border-border bg-secondary/60 text-sm text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-1 focus:ring-primary/40 focus:border-primary/40"
              />
              <textarea
                value={newGoal}
                onChange={e => setNewGoal(e.target.value)}
                placeholder="What is the goal of this project? EYRA will use this to generate intelligence, find funding, and suggest next steps."
                rows={3}
                className="w-full px-4 py-3 rounded-xl border border-border bg-secondary/60 text-sm text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-1 focus:ring-primary/40 focus:border-primary/40 resize-none"
              />
              {(newMilestones || newTasks) && (
                <>
                  <textarea
                    value={newMilestones}
                    onChange={e => setNewMilestones(e.target.value)}
                    placeholder="Milestones..."
                    rows={5}
                    className="w-full px-4 py-3 rounded-xl border border-border bg-secondary/60 text-xs text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-1 focus:ring-primary/40 focus:border-primary/40 resize-none font-mono"
                  />
                  <textarea
                    value={newTasks}
                    onChange={e => setNewTasks(e.target.value)}
                    placeholder="Tasks..."
                    rows={5}
                    className="w-full px-4 py-3 rounded-xl border border-border bg-secondary/60 text-xs text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-1 focus:ring-primary/40 focus:border-primary/40 resize-none font-mono"
                  />
                </>
              )}
              <div className="flex items-center gap-2">
                <button
                  onClick={createProject}
                  disabled={!newTitle.trim() || !newGoal.trim()}
                  className="px-5 py-2.5 rounded-xl eyra-gradient text-white text-sm font-semibold disabled:opacity-40"
                >
                  Create Project
                </button>
                <button onClick={resetForm} className="px-4 py-2.5 rounded-xl text-sm text-muted-foreground hover:bg-secondary transition-colors">
                  Cancel
                </button>
              </div>
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Filter bar */}
      <div className="flex items-center gap-1.5 mb-6 overflow-x-auto pb-1">
        {FILTERS.map(f => (
          <button
            key={f.key}
            onClick={() => setFilterStatus(f.key)}
            className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium whitespace-nowrap transition-all ${
              filterStatus === f.key
                ? 'bg-primary/15 text-primary border border-primary/25'
                : 'text-muted-foreground hover:text-foreground border border-transparent hover:border-border/50'
            }`}
          >
            {f.label}
            <span className="opacity-50 tabular-nums">{counts[f.key] || 0}</span>
          </button>
        ))}
      </div>

      {/* Content */}
      {loading ? (
        <div className="grid gap-4 sm:grid-cols-2">
          {[1, 2, 3, 4].map(i => (
            <div key={i} className="h-36 rounded-xl bg-secondary/30 animate-pulse" />
          ))}
        </div>
      ) : filtered.length === 0 ? (
        <div className="flex flex-col items-center justify-center py-24 text-center">
          <div className="w-16 h-16 rounded-2xl bg-secondary/50 flex items-center justify-center mb-4">
            <FolderOpen size={22} className="text-muted-foreground/50" />
          </div>
          <p className="font-semibold text-sm text-foreground mb-1">
            {filterStatus === 'all' ? 'No projects yet' : `No ${filterStatus} projects`}
          </p>
          <p className="text-xs text-muted-foreground mt-1 max-w-xs leading-relaxed">
            {filterStatus === 'all'
              ? 'Create a project and EYRA will generate research intelligence, roadmaps, and funding recommendations.'
              : 'Try a different filter or create a new project.'
            }
          </p>
          {filterStatus === 'all' && (
            <button onClick={() => setShowNew(true)} className="mt-5 px-5 py-2.5 rounded-xl eyra-gradient text-white text-sm font-semibold">
              Create your first project
            </button>
          )}
        </div>
      ) : (
        <div className="grid gap-4 sm:grid-cols-2">
          {filtered.map(p => {
            const sc = STATUS_CONFIG[p.status || 'planning'] || STATUS_CONFIG.planning;
            const hasAnalysis = !!p.eyra_analysis;
            return (
              <motion.div key={p.id} initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="group relative">
                <Link to={`/projects/${p.id}`} className="block p-5 rounded-xl border border-border bg-card hover:border-primary/25 card-glow transition-all">
                  <div className="flex items-center justify-between mb-3">
                    <span className={`text-[10px] px-2 py-0.5 rounded-full font-semibold ${sc.color}`}>{sc.label}</span>
                    <div className="flex items-center gap-2">
                      {hasAnalysis && (
                        <span className="text-[10px] px-2 py-0.5 rounded-full bg-primary/10 text-primary font-medium flex items-center gap-1">
                          <Sparkles size={8} /> EYRA
                        </span>
                      )}
                      <span className="text-[10px] text-muted-foreground flex items-center gap-1">
                        <Clock size={9} /> {moment(p.updated_date).fromNow()}
                      </span>
                    </div>
                  </div>
                  <h4 className="font-semibold text-sm text-foreground mb-1.5">{p.title}</h4>
                  <p className="text-xs text-muted-foreground line-clamp-2 leading-relaxed mb-4">{p.goal}</p>
                  <div className="flex items-center justify-between pt-3 border-t border-border/50">
                    {!hasAnalysis ? (
                      <span className="text-[10px] text-primary font-medium flex items-center gap-1">
                        <Sparkles size={9} /> Run EYRA analysis
                      </span>
                    ) : (
                      <span className="text-[10px] text-muted-foreground">Intelligence ready</span>
                    )}
                    <span className="text-[10px] text-primary flex items-center gap-1">
                      Open <ChevronRight size={10} />
                    </span>
                  </div>
                </Link>
                <button
                  onClick={(e) => deleteProject(p.id, e)}
                  className="absolute top-3.5 right-3.5 p-1.5 rounded-lg hover:bg-destructive/10 opacity-0 group-hover:opacity-100 transition-all"
                >
                  <Trash2 size={12} className="text-destructive/50" />
                </button>
              </motion.div>
            );
          })}
        </div>
      )}

      {/* EYRA guidance for new users */}
      {!loading && projects.length > 0 && projects.length < 3 && (
        <div className="mt-8 p-5 rounded-2xl border border-border bg-card">
          <div className="flex items-start gap-3">
            <div className="w-8 h-8 rounded-lg overflow-hidden bg-white flex-shrink-0">
              <img src="https://media.base44.com/images/public/6a3b660e73254d1b4bf55bcb/33f475246_image.png" alt="EYRA" className="w-full h-full object-contain" />
            </div>
            <div>
              <p className="text-xs font-semibold text-foreground mb-1">EYRA tip</p>
              <p className="text-xs text-muted-foreground leading-relaxed">
                Open your project and run <span className="text-primary font-medium">EYRA Analysis</span> to get research gaps, collaborator recommendations, funding keywords, and a strategic roadmap.
              </p>
              {projects[0] && (
                <Link to={`/projects/${projects[0].id}`}
                  className="inline-flex items-center gap-1 mt-2 text-xs text-primary font-medium hover:underline">
                  Go to {projects[0].title} <ArrowRight size={11} />
                </Link>
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
