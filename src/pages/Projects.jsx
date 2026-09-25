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
import {
  AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent,
  AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle,
} from '@/components/ui/alert-dialog';

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
  const [working, setWorking] = useState(false);
  const [error, setError] = useState('');
  const [pendingDelete, setPendingDelete] = useState(null);
  const [deletingProject, setDeletingProject] = useState(false);
  const { toast } = useToast();

  useEffect(() => { loadProjects(); }, []);

  const loadProjects = async () => {
    setLoading(true);
    setError('');
    try {
      const data = await base44.entities.Project.list('-updated_date');
      setProjects(data);
    } catch (loadError) {
      setError(loadError?.message || 'Projects could not be loaded.');
    } finally {
      setLoading(false);
    }
  };

  const createProject = async () => {
    if (!newTitle.trim() || !newGoal.trim()) return;
    setWorking(true);
    setError('');
    try {
      await base44.entities.Project.create({
        title: newTitle.trim(),
        goal: newGoal.trim(),
        milestones: newMilestones.trim(),
        tasks: newTasks.trim(),
        status: 'active',
      });
      setNewTitle(''); setNewGoal(''); setNewMilestones(''); setNewTasks('');
      setSelectedTemplate(null); setShowTemplates(true); setShowNew(false);
      await loadProjects();
      toast({ title: 'Project created' });
    } catch (createError) {
      setError(createError?.message || 'Project could not be created.');
    } finally {
      setWorking(false);
    }
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

  const deleteProject = async () => {
    if (!pendingDelete || deletingProject) return;
    setDeletingProject(true);
    try {
      await base44.entities.Project.delete(pendingDelete.id);
      setProjects(previous => previous.filter(project => project.id !== pendingDelete.id));
      toast({ title: 'Project deleted' });
      setPendingDelete(null);
    } catch (deleteError) {
      toast({
        title: 'Could not delete project',
        description: deleteError?.message || 'Please try again.',
        variant: 'destructive',
      });
    } finally {
      setDeletingProject(false);
    }
  };

  const counts = { all: projects.length };
  FILTERS.slice(1).forEach(f => {
    counts[f.key] = projects.filter(p => (p.status || 'planning') === f.key).length;
  });
  const filtered = filterStatus === 'all' ? projects : projects.filter(p => (p.status || 'planning') === filterStatus);

  return (
    <div className="mx-auto max-w-5xl px-4 py-8 sm:px-6 sm:py-12">

      {/* Header */}
      <header className="mb-8 flex flex-col justify-between gap-5 sm:flex-row sm:items-end">
        <div>
          <p className="mb-2 text-xs font-semibold uppercase tracking-[0.16em] text-muted-foreground">Research workspaces</p>
          <h1 className="font-heading text-3xl font-semibold tracking-tight text-foreground sm:text-4xl">Projects</h1>
          <p className="mt-2 max-w-2xl text-sm leading-6 text-muted-foreground">Keep evidence, decisions, notes and next actions together around a research question.</p>
        </div>
        <button
          type="button"
          onClick={() => setShowNew(true)}
          className="inline-flex min-h-10 items-center justify-center gap-2 self-start rounded-xl bg-foreground px-4 text-sm font-semibold text-background transition-opacity hover:opacity-90 sm:self-auto"
        >
          <Plus size={14} aria-hidden="true" /> New project
        </button>
      </header>

      {error && <div role="alert" className="mb-5 rounded-xl border border-red-500/20 bg-red-500/5 px-4 py-3 text-xs text-red-200">{error}</div>}

      {/* New Project Form */}
      <AnimatePresence>
        {showNew && (
          <motion.div
            initial={{ opacity: 0, y: -8 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -8 }}
            className="mb-8 rounded-2xl border border-border bg-card p-5 sm:p-6"
          >
            <div className="flex items-center justify-between mb-4">
              <div>
                <h2 className="text-sm font-semibold text-foreground">Create a project</h2>
                <p className="mt-1 text-xs text-muted-foreground">Start from a question or use a template to structure the workspace.</p>
              </div>
              <button type="button" onClick={resetForm} aria-label="Close new project form" className="grid h-9 w-9 place-items-center rounded-lg text-muted-foreground hover:bg-secondary hover:text-foreground">
                <X size={14} aria-hidden="true" />
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
                className="w-full h-11 px-4 rounded-xl border border-border bg-background text-sm text-foreground placeholder:text-muted-foreground focus:outline-none focus:border-primary/40"
              />
              <textarea
                value={newGoal}
                onChange={e => setNewGoal(e.target.value)}
                placeholder="What is the goal of this project? EYRA will use this to generate intelligence, find funding, and suggest next steps."
                rows={3}
                className="w-full px-4 py-3 rounded-xl border border-border bg-background text-sm text-foreground placeholder:text-muted-foreground focus:outline-none focus:border-primary/40 resize-none"
              />
              {(newMilestones || newTasks) && (
                <>
                  <textarea
                    value={newMilestones}
                    onChange={e => setNewMilestones(e.target.value)}
                    placeholder="Milestones..."
                    rows={5}
                    className="w-full px-4 py-3 rounded-xl border border-border bg-background text-xs text-foreground placeholder:text-muted-foreground focus:outline-none focus:border-primary/40 resize-none font-mono"
                  />
                  <textarea
                    value={newTasks}
                    onChange={e => setNewTasks(e.target.value)}
                    placeholder="Tasks..."
                    rows={5}
                    className="w-full px-4 py-3 rounded-xl border border-border bg-background text-xs text-foreground placeholder:text-muted-foreground focus:outline-none focus:border-primary/40 resize-none font-mono"
                  />
                </>
              )}
              <div className="flex items-center gap-2">
                <button
                  onClick={createProject}
                  disabled={!newTitle.trim() || !newGoal.trim() || working}
                  className="min-h-10 rounded-xl bg-primary px-5 text-sm font-semibold text-primary-foreground transition-colors hover:bg-primary/90 disabled:cursor-not-allowed disabled:opacity-40"
                >
                  {working ? 'Creating…' : 'Create Project'}
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
      <div className="mb-6 flex items-center gap-1 overflow-x-auto border-b border-border pb-4">
        {FILTERS.map(f => (
          <button
            key={f.key}
            onClick={() => setFilterStatus(f.key)}
            className={`flex min-h-9 items-center gap-1.5 whitespace-nowrap rounded-lg px-3 text-xs font-semibold transition-colors ${
              filterStatus === f.key
                ? 'bg-foreground text-background'
                : 'text-muted-foreground hover:bg-secondary hover:text-foreground'
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
            <div key={i} className="h-40 animate-pulse rounded-2xl border border-border bg-card p-5"><div className="h-3 w-20 rounded bg-secondary" /><div className="mt-5 h-4 w-2/3 rounded bg-secondary" /><div className="mt-3 h-3 w-full rounded bg-secondary/70" /><div className="mt-2 h-3 w-4/5 rounded bg-secondary/60" /></div>
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
            <button type="button" onClick={() => setShowNew(true)} className="mt-5 rounded-xl bg-foreground px-5 py-2.5 text-sm font-semibold text-background">
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
                <Link to={`/projects/${p.id}`} className="block min-h-44 rounded-2xl border border-border bg-card p-5 transition-colors hover:border-primary/30">
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
                  type="button"
                  onClick={(event) => {
                    event.preventDefault();
                    event.stopPropagation();
                    setPendingDelete({ id: p.id, title: p.title });
                  }}
                  aria-label={`Delete ${p.title}`}
                  className="absolute right-3.5 top-3.5 grid h-8 w-8 place-items-center rounded-lg text-muted-foreground opacity-100 transition-colors hover:bg-destructive/10 hover:text-destructive sm:opacity-0 sm:group-hover:opacity-100"
                >
                  <Trash2 size={12} className="text-destructive/50" />
                </button>
              </motion.div>
            );
          })}
        </div>
      )}

      {!loading && projects.length > 0 && projects.length < 3 && projects[0] && (
        <div className="mt-8 flex flex-col justify-between gap-4 border-t border-border pt-6 sm:flex-row sm:items-center">
          <div>
            <p className="text-xs font-semibold text-foreground">Continue where the evidence lives.</p>
            <p className="mt-1 text-xs leading-5 text-muted-foreground">Open a project to review its research context, run EYRA and choose the next action.</p>
          </div>
          <Link to={`/projects/${projects[0].id}`} className="inline-flex items-center gap-2 self-start text-xs font-semibold text-primary hover:underline sm:self-auto">
            Open {projects[0].title} <ArrowRight size={11} aria-hidden="true" />
          </Link>
        </div>
      )}

      <AlertDialog open={Boolean(pendingDelete)} onOpenChange={open => !open && !deletingProject && setPendingDelete(null)}>
        <AlertDialogContent className="max-w-md rounded-2xl">
          <AlertDialogHeader>
            <AlertDialogTitle>Delete this project?</AlertDialogTitle>
            <AlertDialogDescription>
              {pendingDelete?.title ? `“${pendingDelete.title}” and its project record will be deleted. This action cannot be undone.` : 'This project will be deleted permanently.'}
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={deletingProject}>Cancel</AlertDialogCancel>
            <AlertDialogAction
              onClick={event => {
                event.preventDefault();
                deleteProject();
              }}
              disabled={deletingProject}
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
            >
              {deletingProject ? 'Deleting…' : 'Delete project'}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
