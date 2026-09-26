import React, { useEffect, useState } from 'react';
import { Command } from 'cmdk';
import { useNavigate } from 'react-router-dom';
import {
  BookOpen, FolderOpen, History, Lightbulb, Plus, Search,
  Settings, Sparkles, Users, Video, X, Award,
} from 'lucide-react';

const COMMANDS = [
  { group: 'Navigate', label: 'Home', path: '/home', icon: Search, keywords: 'start' },
  { group: 'Navigate', label: 'Projects', path: '/projects', icon: FolderOpen, keywords: 'search project' },
  { group: 'Navigate', label: 'Library', path: '/library', icon: BookOpen, keywords: 'saved papers evidence' },
  { group: 'Navigate', label: 'Funding', path: '/opportunities', icon: Award, keywords: 'grants' },
  { group: 'Navigate', label: 'Researchers', path: '/researchers', icon: Users, keywords: 'people authors' },
  { group: 'Navigate', label: 'Meetings', path: '/meetings', icon: Video, keywords: 'notes decisions' },
  { group: 'Navigate', label: 'Search history', path: '/history', icon: History, keywords: 'previous searches' },
  { group: 'Navigate', label: 'Settings', path: '/settings', icon: Settings, keywords: 'preferences' },
  { group: 'Actions', label: 'New project', path: '/projects?new=1', icon: Plus, keywords: 'create' },
  { group: 'Actions', label: 'New search', path: '/home', icon: Search, keywords: 'discover literature evidence' },
  { group: 'Actions', label: 'Save an idea', path: '/ideas?new=1', icon: Lightbulb, keywords: 'capture' },
  { group: 'Intelligence', label: 'Ask EYRA', action: 'eyra', icon: Sparkles, keywords: 'ai assistant reason' },
];

export default function GlobalCommandCenter({ open, onClose }) {
  const [query, setQuery] = useState('');
  const navigate = useNavigate();

  useEffect(() => {
    if (!open) return undefined;
    setQuery('');
    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    return () => { document.body.style.overflow = previousOverflow; };
  }, [open]);

  if (!open) return null;

  const selectCommand = command => {
    onClose();
    if (command.action === 'eyra') {
      window.dispatchEvent(new Event('eylo:open-eyra'));
      return;
    }
    navigate(command.path);
  };
  const searchActions = query.trim().length >= 2
    ? [
      { group: 'Search this', label: 'Search projects', path: `/projects?q=${encodeURIComponent(query.trim())}`, icon: FolderOpen },
      { group: 'Search this', label: 'Search Library', path: `/library?q=${encodeURIComponent(query.trim())}`, icon: BookOpen },
      { group: 'Search this', label: 'Find researchers', path: `/researchers?q=${encodeURIComponent(query.trim())}`, icon: Users },
      { group: 'Search this', label: 'Search funding', path: `/opportunities?q=${encodeURIComponent(query.trim())}`, icon: Award },
      { group: 'Search this', label: 'Search history', path: `/history?q=${encodeURIComponent(query.trim())}`, icon: History },
    ]
    : [];

  return (
    <div className="fixed inset-0 z-[100] flex items-start justify-center bg-black/65 px-4 pt-[12vh] backdrop-blur-sm" onMouseDown={event => { if (event.target === event.currentTarget) onClose(); }}>
      <div role="dialog" aria-modal="true" aria-label="EYLO command center" className="w-full max-w-xl overflow-hidden rounded-2xl border border-border bg-popover shadow-2xl shadow-black/50" onKeyDown={event => {
        if (event.key === 'Escape') { event.preventDefault(); onClose(); }
        if (event.key === 'Tab') {
          const focusable = Array.from(event.currentTarget.querySelectorAll('input:not([disabled]), button:not([disabled])'));
          const first = focusable[0];
          const last = focusable.at(-1);
          if (event.shiftKey && document.activeElement === first) { event.preventDefault(); if (last instanceof HTMLElement) last.focus(); }
          else if (!event.shiftKey && document.activeElement === last) { event.preventDefault(); if (first instanceof HTMLElement) first.focus(); }
        }
      }}>
        <Command label="EYLO command center" loop shouldFilter>
          <div className="flex items-center gap-3 border-b border-border px-4">
            <Search size={17} className="shrink-0 text-muted-foreground" aria-hidden="true" />
            <Command.Input autoFocus value={query} onValueChange={setQuery} placeholder="Search or jump to…" className="h-14 min-w-0 flex-1 bg-transparent text-base outline-none placeholder:text-muted-foreground" />
            <button type="button" onClick={onClose} aria-label="Close command center" className="grid h-8 w-8 place-items-center rounded-md text-muted-foreground hover:bg-secondary hover:text-foreground"><X size={15} /></button>
          </div>
          <Command.List className="max-h-[min(65vh,32rem)] overflow-y-auto p-2">
            <Command.Empty className="px-3 py-8 text-center text-sm text-muted-foreground">No matching actions.</Command.Empty>
            {searchActions.length > 0 && (
              <Command.Group heading="Search this" className="mb-2 [&_[cmdk-group-heading]]:px-3 [&_[cmdk-group-heading]]:py-2 [&_[cmdk-group-heading]]:text-xs [&_[cmdk-group-heading]]:font-semibold [&_[cmdk-group-heading]]:text-muted-foreground">
                {searchActions.map(item => {
                  const Icon = item.icon;
                  return <Command.Item key={item.label} value={`${item.label} ${query}`} onSelect={() => selectCommand(item)} className="flex min-h-11 cursor-pointer items-center gap-3 rounded-lg px-3 text-sm text-foreground aria-selected:bg-secondary aria-selected:text-foreground"><Icon size={15} className="text-muted-foreground" aria-hidden="true" />{item.label}<span className="ml-auto max-w-[55%] truncate text-xs text-muted-foreground">{query}</span></Command.Item>;
                })}
              </Command.Group>
            )}
            {['Navigate', 'Actions', 'Intelligence'].map(group => (
              <Command.Group key={group} heading={group} className="mb-2 [&_[cmdk-group-heading]]:px-3 [&_[cmdk-group-heading]]:py-2 [&_[cmdk-group-heading]]:text-xs [&_[cmdk-group-heading]]:font-semibold [&_[cmdk-group-heading]]:text-muted-foreground">
                {COMMANDS.filter(item => item.group === group).map(item => {
                  const Icon = item.icon;
                  return (
                    <Command.Item key={`${item.group}-${item.label}`} value={`${item.label} ${item.keywords}`} onSelect={() => selectCommand(item)} className="flex min-h-11 cursor-pointer items-center gap-3 rounded-lg px-3 text-sm text-foreground aria-selected:bg-secondary aria-selected:text-foreground">
                      <Icon size={15} className="text-muted-foreground" aria-hidden="true" />
                      <span className="flex-1">{item.label}</span>
                      {item.label === 'Ask EYRA' && <span className="font-mono text-xs text-muted-foreground">⌘K</span>}
                    </Command.Item>
                  );
                })}
              </Command.Group>
            ))}
          </Command.List>
          <div className="flex items-center justify-between border-t border-border px-4 py-2.5 text-xs text-muted-foreground">
            <span>Move with ↑ ↓ · Open with ↵</span><span className="font-mono">ESC</span>
          </div>
        </Command>
      </div>
    </div>
  );
}
