import React, { useEffect, useRef, useState } from 'react';
import { Bell } from 'lucide-react';
import { Link } from 'react-router-dom';
import { monitoringStore } from '@/lib/monitoring-service';

export default function NotificationsBell() {
  const [items, setItems] = useState([]);
  const [open, setOpen] = useState(false);
  const rootRef = useRef(null);

  useEffect(() => {
    const refresh = () => setItems(monitoringStore.notifications());
    refresh();
    return monitoringStore.subscribe(refresh);
  }, []);

  useEffect(() => {
    const close = event => {
      if (event.key === 'Escape' || (rootRef.current && !rootRef.current.contains(event.target))) setOpen(false);
    };
    document.addEventListener('mousedown', close);
    document.addEventListener('keydown', close);
    return () => {
      document.removeEventListener('mousedown', close);
      document.removeEventListener('keydown', close);
    };
  }, []);

  const activeItems = items.filter(item => !item.dismissed);
  const unread = activeItems.filter(item => !item.read).length;

  return (
    <div className="relative" ref={rootRef}>
      <button
        type="button"
        onClick={() => setOpen(value => !value)}
        aria-label={`${unread} unread notifications`}
        aria-expanded={open}
        aria-haspopup="dialog"
        className="relative rounded-xl p-2.5 text-muted-foreground hover:bg-secondary hover:text-foreground"
      >
        <Bell size={16} />
        {unread > 0 && <span className="absolute right-1 top-1 min-w-4 rounded-full bg-primary px-1 text-center text-[9px] font-bold text-white">{unread > 9 ? '9+' : unread}</span>}
      </button>

      {open && (
        <div role="dialog" aria-label="Recent EYRA notifications" className="absolute right-0 top-full z-50 mt-2 w-[min(20rem,calc(100vw-2rem))] rounded-2xl border border-border bg-card p-3 shadow-2xl">
          <div className="mb-2 flex items-center justify-between">
            <p className="text-xs font-bold">EYRA notifications</p>
            <button type="button" onClick={() => monitoringStore.markAllRead()} disabled={!unread} className="text-[10px] text-primary disabled:opacity-40">Mark all read</button>
          </div>
          <div className="max-h-72 space-y-1 overflow-y-auto">
            {activeItems.slice(0, 6).map(item => {
              const content = (
                <>
                  <p className="line-clamp-2 text-xs font-semibold">{item.title}</p>
                  <p className="mt-1 text-[10px] text-muted-foreground">{item.priority} · {item.type}</p>
                </>
              );
              const className = `block rounded-xl p-3 hover:bg-secondary/60 ${item.read ? 'opacity-60' : 'bg-primary/5'}`;
              return item.sourceUrl ? (
                <a key={item.id} href={item.sourceUrl} target="_blank" rel="noopener noreferrer" onClick={() => monitoringStore.markNotification(item.id, { read: true })} className={className}>{content}</a>
              ) : (
                <Link key={item.id} to="/notifications" onClick={() => { monitoringStore.markNotification(item.id, { read: true }); setOpen(false); }} className={className}>{content}</Link>
              );
            })}
            {!activeItems.length && <p className="py-6 text-center text-xs text-muted-foreground">No notifications yet.</p>}
          </div>
          <Link to="/notifications" onClick={() => setOpen(false)} className="mt-2 block rounded-xl border border-border py-2 text-center text-xs font-semibold">View all</Link>
        </div>
      )}
    </div>
  );
}
