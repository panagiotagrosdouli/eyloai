import React, { useEffect, useMemo, useState } from 'react';
import { Bell, CheckCheck, ExternalLink, Trash2 } from 'lucide-react';
import { monitoringStore } from '@/lib/monitoring-service';

const FILTERS = [
  { id: 'all', label: 'All' },
  { id: 'unread', label: 'Unread' },
  { id: 'paper', label: 'Papers' },
  { id: 'researcher', label: 'Researchers' },
  { id: 'institution', label: 'Institutions' },
  { id: 'opportunity', label: 'Funding' },
];

export default function Notifications() {
  const [items, setItems] = useState([]);
  const [filter, setFilter] = useState('all');

  useEffect(() => {
    const refresh = () => setItems(monitoringStore.notifications());
    refresh();
    return monitoringStore.subscribe(refresh);
  }, []);

  const visibleItems = useMemo(() => items.filter(item => {
    if (item.dismissed) return false;
    if (filter === 'unread') return !item.read;
    if (filter === 'all') return true;
    return item.type === filter;
  }), [filter, items]);

  const unreadCount = items.filter(item => !item.dismissed && !item.read).length;

  return (
    <div className="mx-auto max-w-4xl px-4 py-8 sm:py-10">
      <header className="mb-7 flex flex-col justify-between gap-4 sm:flex-row sm:items-center">
        <div><h1 className="font-heading text-2xl font-bold">Notifications</h1><p className="text-xs text-muted-foreground">{unreadCount} unread</p></div>
        <button
          type="button"
          onClick={() => monitoringStore.markAllRead()}
          disabled={unreadCount === 0}
          className="inline-flex min-h-10 items-center justify-center gap-2 rounded-xl border border-border px-4 py-2 text-xs font-semibold hover:bg-secondary disabled:opacity-40"
        >
          <CheckCheck size={13} /> Clear
        </button>
      </header>

      <div className="mb-5 flex gap-2 overflow-x-auto pb-1" role="tablist" aria-label="Notification filters">
        {FILTERS.map(option => (
          <button
            key={option.id}
            type="button"
            role="tab"
            aria-selected={filter === option.id}
            onClick={() => setFilter(option.id)}
            className={`whitespace-nowrap rounded-lg px-3 py-2 text-xs font-medium ${filter === option.id ? 'bg-primary text-primary-foreground' : 'bg-secondary text-muted-foreground hover:text-foreground'}`}
          >
            {option.label}
          </button>
        ))}
      </div>

      <div className="space-y-3" aria-live="polite">
        {visibleItems.map(item => (
          <article key={item.id} className={`rounded-2xl border border-border p-5 transition-colors ${item.read ? 'bg-card/60' : 'bg-primary/5'}`}>
            <div className="flex gap-4">
              <button
                type="button"
                onClick={() => monitoringStore.markNotification(item.id, { read: true })}
                className="min-w-0 flex-1 text-left"
                aria-label={`Mark ${item.title} as read`}
              >
                <p className="text-[10px] font-bold uppercase tracking-wider text-primary">{item.priority} · {item.type}</p>
                <h2 className="mt-1 font-heading font-semibold text-foreground">{item.title}</h2>
                <p className="mt-2 text-xs leading-5 text-muted-foreground">{item.description}</p>
              </button>
              <div className="flex shrink-0 items-start gap-1">
                {item.sourceUrl && (
                  <a
                    href={item.sourceUrl}
                    target="_blank"
                    rel="noopener noreferrer"
                    onClick={() => monitoringStore.markNotification(item.id, { read: true })}
                    className="rounded-lg p-2 text-primary hover:bg-primary/10"
                    aria-label={`Open source for ${item.title}`}
                  >
                    <ExternalLink size={14} />
                  </a>
                )}
                <button
                  type="button"
                  onClick={() => monitoringStore.markNotification(item.id, { dismissed: true, read: true })}
                  className="rounded-lg p-2 text-muted-foreground hover:bg-secondary hover:text-foreground"
                  aria-label={`Dismiss ${item.title}`}
                >
                  <Trash2 size={14} />
                </button>
              </div>
            </div>
          </article>
        ))}

        {visibleItems.length === 0 && (
          <div className="rounded-2xl border border-dashed border-border px-5 py-14 text-center">
            <Bell size={22} className="mx-auto text-muted-foreground/50" />
            <p className="mt-3 text-sm font-medium">No notifications in this view</p>
            <p className="mt-1 text-xs text-muted-foreground">New verified watchlist findings will appear here.</p>
          </div>
        )}
      </div>
    </div>
  );
}
