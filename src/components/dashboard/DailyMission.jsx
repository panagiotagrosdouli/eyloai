import React, { useState, useEffect } from 'react';
import { getDailyMission } from '@/lib/second-brain';
import { CheckCircle2, Clock, Loader2, ChevronDown, ChevronUp, Sparkles } from 'lucide-react';

const TYPE_CONFIG = {
  read: { emoji: '📖', color: 'bg-blue-500/10 text-blue-400 border-blue-500/20' },
  discover: { emoji: '🔭', color: 'bg-primary/10 text-primary border-primary/20' },
  connect: { emoji: '🤝', color: 'bg-green-500/10 text-green-400 border-green-500/20' },
  write: { emoji: '✍️', color: 'bg-purple-500/10 text-purple-400 border-purple-500/20' },
  review: { emoji: '🎯', color: 'bg-amber-500/10 text-amber-400 border-amber-500/20' },
};

export default function DailyMission({ profile }) {
  const [mission, setMission] = useState(null);
  const [loading, setLoading] = useState(true);
  const [completed, setCompleted] = useState({});
  const [collapsed, setCollapsed] = useState(false);

  useEffect(() => {
    if (!profile) return;
    loadMission();
    // Restore completed state from localStorage
    const saved = localStorage.getItem('eyra_mission_completed_' + new Date().toDateString());
    if (saved) try { setCompleted(JSON.parse(saved)); } catch {}
  }, [profile]);

  const loadMission = async () => {
    setLoading(true);
    const m = await getDailyMission(profile);
    setMission(m);
    setLoading(false);
  };

  const toggleComplete = (i) => {
    const next = { ...completed, [i]: !completed[i] };
    setCompleted(next);
    localStorage.setItem('eyra_mission_completed_' + new Date().toDateString(), JSON.stringify(next));
  };

  const doneCount = Object.values(completed).filter(Boolean).length;
  const totalTasks = mission?.tasks?.length || 3;
  const allDone = doneCount === totalTasks && totalTasks > 0;

  return (
    <div className={`rounded-2xl border overflow-hidden transition-all ${allDone ? 'border-green-500/25 bg-green-500/5' : 'border-border bg-card'}`}>
      {/* Header */}
      <div className="flex items-center gap-3 px-5 py-3.5">
        <div className="flex-1">
          <div className="flex items-center gap-2">
            <span className="text-sm font-semibold text-foreground">
              {allDone ? '✅ Mission Complete!' : "Today's Mission"}
            </span>
            {!loading && mission && (
              <span className="text-[10px] text-muted-foreground">
                {doneCount}/{totalTasks} done
              </span>
            )}
          </div>
          {mission && !loading && !collapsed && (
            <p className="text-xs text-primary font-medium mt-0.5">{mission.headline}</p>
          )}
        </div>
        {/* Progress dots */}
        {!loading && mission && (
          <div className="flex items-center gap-1 mr-2">
            {mission.tasks?.map((_, i) => (
              <div key={i} className={`w-2 h-2 rounded-full transition-all ${completed[i] ? 'bg-green-400' : 'bg-border'}`} />
            ))}
          </div>
        )}
        <button onClick={() => setCollapsed(!collapsed)} className="p-1.5 rounded-lg hover:bg-secondary text-muted-foreground transition-colors">
          {collapsed ? <ChevronDown size={13} /> : <ChevronUp size={13} />}
        </button>
      </div>

      {/* Body */}
      {!collapsed && (
        <div className="px-5 pb-4">
          {loading ? (
            <div className="flex items-center gap-2 py-2">
              <Loader2 size={13} className="animate-spin text-primary" />
              <span className="text-xs text-muted-foreground">EYRA is generating your mission...</span>
            </div>
          ) : mission ? (
            <>
              <div className="space-y-2 mb-3">
                {mission.tasks?.map((task, i) => {
                  const cfg = TYPE_CONFIG[task.type] || TYPE_CONFIG.review;
                  return (
                    <button
                      key={i}
                      onClick={() => toggleComplete(i)}
                      className={`w-full flex items-center gap-3 p-3 rounded-xl border text-left transition-all ${
                        completed[i] ? 'opacity-50 line-through' : 'hover:border-primary/25'
                      } ${cfg.color}`}
                    >
                      <span className="text-base flex-shrink-0">{cfg.emoji}</span>
                      <div className="flex-1 min-w-0">
                        <p className="text-xs font-medium">{task.task}</p>
                      </div>
                      <div className="flex items-center gap-2 flex-shrink-0">
                        <span className="text-[10px] flex items-center gap-1 opacity-70">
                          <Clock size={9} /> {task.estimated_minutes}m
                        </span>
                        <div className={`w-4 h-4 rounded-full border-2 flex items-center justify-center flex-shrink-0 transition-all ${completed[i] ? 'bg-green-400 border-green-400' : 'border-current opacity-40'}`}>
                          {completed[i] && <CheckCircle2 size={10} className="text-white" />}
                        </div>
                      </div>
                    </button>
                  );
                })}
              </div>
              {mission.motivation && (
                <p className="text-[11px] text-muted-foreground italic flex items-center gap-1.5">
                  <Sparkles size={10} className="text-primary flex-shrink-0" />
                  {mission.motivation}
                </p>
              )}
            </>
          ) : null}
        </div>
      )}
    </div>
  );
}
