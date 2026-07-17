import React, { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import { base44 } from '@/api/base44Client';
import {
  Zap, Loader2, CheckCircle2, Clock, ChevronDown, ChevronUp,
  BookOpen, FileText, Users, Search, Edit3, AlertCircle, RefreshCw
} from 'lucide-react';

const TASK_TYPES = {
  read:     { icon: BookOpen, emoji: '📖', color: 'border-blue-500/20 bg-blue-500/5 text-blue-400' },
  write:    { icon: Edit3,    emoji: '✍️', color: 'border-purple-500/20 bg-purple-500/5 text-purple-400' },
  discover: { icon: Search,   emoji: '🔭', color: 'border-primary/20 bg-primary/5 text-primary' },
  connect:  { icon: Users,    emoji: '🤝', color: 'border-green-500/20 bg-green-500/5 text-green-400' },
  review:   { icon: FileText, emoji: '🎯', color: 'border-amber-500/20 bg-amber-500/5 text-amber-400' },
  admin:    { icon: AlertCircle, emoji: '📋', color: 'border-rose-500/20 bg-rose-500/5 text-rose-400' },
};

function ProjectMissions({ project, globalCompleted, onToggle }) {
  const [tasks, setTasks] = useState(null);
  const [loading, setLoading] = useState(true);
  const [collapsed, setCollapsed] = useState(false);

  const cacheKey = `eyra_daily_missions_${project.id}_${new Date().toDateString()}`;

  useEffect(() => {
    const cached = localStorage.getItem(cacheKey);
    if (cached) {
      try { setTasks(JSON.parse(cached)); setLoading(false); return; } catch {}
    }
    generate();
  }, [project.id]);

  const generate = async () => {
    setLoading(true);

    // Fetch real saved papers for context
    let savedPapers = [];
    try {
      savedPapers = await base44.entities.SavedPaper.list('-created_date', 10);
    } catch {}

    const paperContext = savedPapers.length > 0
      ? `\nSaved papers in library (use these for specific read tasks):\n${savedPapers.slice(0, 5).map(p => `- "${p.title}" by ${p.authors || 'Unknown'} (${p.year || ''})`).join('\n')}`
      : '';

    const result = await base44.integrations.Core.InvokeLLM({
      prompt: `You are EYRA, an autonomous research AI. Break down this active research project into 4-5 specific, actionable daily tasks that the researcher should complete TODAY.

Project: "${project.title}"
Goal: "${project.goal || ''}"
Description: "${project.description || ''}"
Status: "${project.status}"
Milestones: "${project.milestones || 'Not defined'}"
Tasks so far: "${project.tasks || 'None'}"
${paperContext}

Generate a mix of task types. If there are saved papers above, include a specific "read" task referencing an actual paper title. All tasks must be:
- Specific to THIS project and real data above (not generic)
- Completable in 15-45 minutes
- Immediately actionable

Return JSON array "tasks":
[{ task: string, type: "read"|"write"|"discover"|"connect"|"review"|"admin", minutes: number, project_area: string }]`,
      response_json_schema: {
        type: 'object',
        properties: {
          tasks: {
            type: 'array',
            items: {
              type: 'object',
              properties: {
                task: { type: 'string' },
                type: { type: 'string' },
                minutes: { type: 'number' },
                project_area: { type: 'string' },
              }
            }
          }
        }
      }
    });
    const t = result?.tasks || [];
    setTasks(t);
    localStorage.setItem(cacheKey, JSON.stringify(t));
    setLoading(false);
  };

  const refresh = () => {
    localStorage.removeItem(cacheKey);
    setTasks(null);
    generate();
  };

  const completedCount = tasks?.filter((_, i) => globalCompleted[`${project.id}_${i}`]).length || 0;
  const totalCount = tasks?.length || 0;
  const allDone = completedCount === totalCount && totalCount > 0;

  return (
    <div className={`rounded-xl border overflow-hidden transition-all ${allDone ? 'border-green-500/25 bg-green-500/5' : 'border-border bg-card'}`}>
      {/* Project header */}
      <div
        className="flex items-center gap-3 px-4 py-3 cursor-pointer hover:bg-secondary/20 transition-colors"
        onClick={() => setCollapsed(!collapsed)}
      >
        <div className={`w-2 h-2 rounded-full flex-shrink-0 ${
          project.status === 'active' ? 'bg-green-400' :
          project.status === 'paused' ? 'bg-amber-400' : 'bg-muted-foreground/40'
        }`} />
        <div className="flex-1 min-w-0">
          <p className="text-xs font-semibold text-foreground truncate">{project.title}</p>
          {!loading && tasks && (
            <p className="text-[10px] text-muted-foreground">
              {allDone ? '✅ All done today!' : `${completedCount}/${totalCount} tasks completed`}
            </p>
          )}
        </div>
        {/* Progress dots */}
        {!loading && tasks && (
          <div className="flex items-center gap-1 flex-shrink-0">
            {tasks.map((_, i) => (
              <div key={i} className={`w-1.5 h-1.5 rounded-full transition-all ${globalCompleted[`${project.id}_${i}`] ? 'bg-green-400' : 'bg-border'}`} />
            ))}
          </div>
        )}
        <div className="flex items-center gap-1.5 flex-shrink-0">
          {!loading && (
            <button
              onClick={e => { e.stopPropagation(); refresh(); }}
              className="p-1 rounded hover:bg-secondary text-muted-foreground transition-colors"
              title="Regenerate tasks"
            >
              <RefreshCw size={11} />
            </button>
          )}
          <Link
            to={`/projects/${project.id}`}
            onClick={e => e.stopPropagation()}
            className="text-[10px] text-primary hover:underline font-medium"
          >
            Open
          </Link>
          {collapsed ? <ChevronDown size={13} className="text-muted-foreground" /> : <ChevronUp size={13} className="text-muted-foreground" />}
        </div>
      </div>

      {/* Tasks */}
      {!collapsed && (
        <div className="px-4 pb-3 space-y-1.5 border-t border-border/40 pt-3">
          {loading ? (
            <div className="flex items-center gap-2 py-3">
              <Loader2 size={12} className="animate-spin text-primary" />
              <span className="text-xs text-muted-foreground">EYRA is generating tasks for this project...</span>
            </div>
          ) : tasks?.map((task, i) => {
            const key = `${project.id}_${i}`;
            const done = !!globalCompleted[key];
            const cfg = TASK_TYPES[task.type] || TASK_TYPES.review;
            return (
              <button
                key={i}
                onClick={() => onToggle(key)}
                className={`w-full flex items-center gap-3 p-3 rounded-xl border text-left transition-all ${
                  done ? 'opacity-40 border-border/30 bg-transparent' : `${cfg.color} hover:opacity-90`
                }`}
              >
                <span className="text-base flex-shrink-0">{cfg.emoji}</span>
                <div className="flex-1 min-w-0">
                  <p className={`text-xs font-medium leading-snug ${done ? 'line-through text-muted-foreground' : 'text-foreground'}`}>
                    {task.task}
                  </p>
                  {task.project_area && (
                    <p className="text-[10px] text-muted-foreground mt-0.5">{task.project_area}</p>
                  )}
                </div>
                <div className="flex items-center gap-2 flex-shrink-0">
                  <span className="text-[10px] text-muted-foreground flex items-center gap-0.5">
                    <Clock size={9} /> {task.minutes}m
                  </span>
                  <div className={`w-4 h-4 rounded-full border-2 flex items-center justify-center transition-all flex-shrink-0 ${
                    done ? 'bg-green-400 border-green-400' : 'border-current opacity-40'
                  }`}>
                    {done && <CheckCircle2 size={9} className="text-white" />}
                  </div>
                </div>
              </button>
            );
          })}
        </div>
      )}
    </div>
  );
}

export default function DailyMissions({ projects }) {
  const [collapsed, setCollapsed] = useState(false);
  const [completed, setCompleted] = useState({});

  const today = new Date().toDateString();
  const storageKey = `eyra_missions_done_${today}`;

  useEffect(() => {
    const saved = localStorage.getItem(storageKey);
    if (saved) try { setCompleted(JSON.parse(saved)); } catch {}
  }, []);

  const toggleTask = (key) => {
    const next = { ...completed, [key]: !completed[key] };
    setCompleted(next);
    localStorage.setItem(storageKey, JSON.stringify(next));
  };

  const activeProjects = projects?.filter(p => p.status === 'active' || p.status === 'planning') || [];

  if (activeProjects.length === 0) return null;

  const totalTasks = activeProjects.length * 4; // approximate
  const doneCount = Object.values(completed).filter(Boolean).length;

  return (
    <div className="rounded-2xl border border-border bg-card overflow-hidden">
      {/* Section header */}
      <div
        className="flex items-center gap-3 px-5 py-4 cursor-pointer hover:bg-secondary/20 transition-colors"
        onClick={() => setCollapsed(!collapsed)}
      >
        <div className="w-8 h-8 rounded-xl bg-primary/10 flex items-center justify-center flex-shrink-0">
          <Zap size={15} className="text-primary" />
        </div>
        <div className="flex-1">
          <p className="text-[10px] font-bold uppercase tracking-widest text-muted-foreground/60 mb-0.5">Daily Missions</p>
          <p className="text-sm font-semibold text-foreground">
            EYRA-generated tasks from your active projects
          </p>
        </div>
        <div className="flex items-center gap-2 flex-shrink-0">
          <span className="text-[10px] px-2 py-0.5 rounded-full bg-primary/10 text-primary font-semibold">
            {doneCount} done today
          </span>
          {collapsed ? <ChevronDown size={14} className="text-muted-foreground" /> : <ChevronUp size={14} className="text-muted-foreground" />}
        </div>
      </div>

      {!collapsed && (
        <div className="px-4 pb-4 space-y-3 border-t border-border/40 pt-3">
          <p className="text-[11px] text-muted-foreground px-1">
            EYRA breaks down each active project into daily research, writing, and administrative tasks. Refreshes every 24 hours.
          </p>
          {activeProjects.map(project => (
            <ProjectMissions
              key={project.id}
              project={project}
              globalCompleted={completed}
              onToggle={toggleTask}
            />
          ))}
        </div>
      )}
    </div>
  );
}
