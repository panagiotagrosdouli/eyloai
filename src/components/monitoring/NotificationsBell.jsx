import React, { useEffect, useState } from 'react';
import { Bell } from 'lucide-react';
import { Link } from 'react-router-dom';
import { monitoringStore } from '@/lib/monitoring-service';

export default function NotificationsBell() {
  const [items, setItems] = useState([]); const [open, setOpen] = useState(false); const refresh = () => setItems(monitoringStore.notifications());
  useEffect(() => { refresh(); return monitoringStore.subscribe(refresh); }, []);
  const unread = items.filter(x => !x.read).length;
  return <div className="relative"><button onClick={() => setOpen(!open)} aria-label={`${unread} unread notifications`} className="relative rounded-xl p-2.5 text-muted-foreground hover:bg-secondary hover:text-foreground"><Bell size={16} />{unread > 0 && <span className="absolute right-1 top-1 min-w-4 rounded-full bg-primary px-1 text-center text-[9px] font-bold text-white">{unread > 9 ? '9+' : unread}</span>}</button>{open && <div className="absolute right-0 top-full z-50 mt-2 w-80 rounded-2xl border border-border bg-card p-3 shadow-2xl"><div className="mb-2 flex items-center justify-between"><p className="text-xs font-bold">EYRA notifications</p><button onClick={() => monitoringStore.markAllRead()} className="text-[10px] text-primary">Mark all read</button></div><div className="max-h-72 space-y-1 overflow-y-auto">{items.slice(0, 6).map(item => <a key={item.id} href={item.sourceUrl} target="_blank" rel="noreferrer" onClick={() => monitoringStore.markNotification(item.id, { read: true })} className={`block rounded-xl p-3 ${item.read ? 'opacity-60' : 'bg-primary/5'}`}><p className="line-clamp-2 text-xs font-semibold">{item.title}</p><p className="mt-1 text-[10px] text-muted-foreground">{item.priority} · {item.type}</p></a>)}{!items.length && <p className="py-6 text-center text-xs text-muted-foreground">No notifications yet.</p>}</div><Link to="/notifications" onClick={() => setOpen(false)} className="mt-2 block rounded-xl border border-border py-2 text-center text-xs font-semibold">View all</Link></div>}</div>;
}
