import React, { useEffect } from 'react';
import { Command } from 'cmdk';
import { ArrowRight, CornerDownLeft, Search, Sparkles } from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import { buildResearchUrl } from '@/lib/command-shortcuts';

export default function GlobalCommandPalette({
  open,
  onOpenChange,
  groups,
  onAskEyra,
  query,
  onQueryChange,
}) {
  const navigate = useNavigate();
  const normalizedQuery = String(query || '').trim();

  useEffect(() => {
    if (!open) onQueryChange('');
  }, [onOpenChange, onQueryChange, open]);

  const go = (path) => {
    onOpenChange(false);
    navigate(path);
  };

  const startResearch = () => {
    go(buildResearchUrl(normalizedQuery));
  };

  const askEyra = () => {
    onOpenChange(false);
    onAskEyra(normalizedQuery);
  };

  return (
    <Command.Dialog
      open={open}
      onOpenChange={onOpenChange}
      label="Search EYLO and run commands"
      loop
      className="fixed left-1/2 top-[12vh] z-[130] w-[min(42rem,calc(100vw-2rem))] -translate-x-1/2 overflow-hidden rounded-2xl border border-border bg-popover shadow-2xl shadow-black/40"
    >
      <div className="flex items-center gap-3 border-b border-border px-4">
        <Search size={17} className="shrink-0 text-muted-foreground" aria-hidden="true" />
        <Command.Input
          value={query}
          onValueChange={onQueryChange}
          autoFocus
          placeholder="Search EYLO or type a research question…"
          className="h-14 w-full bg-transparent text-sm text-foreground outline-none placeholder:text-muted-foreground"
        />
        <kbd className="hidden rounded-md border border-border bg-secondary px-1.5 py-1 font-mono text-[9px] text-muted-foreground sm:inline-flex">Esc</kbd>
      </div>

      <Command.List className="max-h-[min(64vh,34rem)] overflow-y-auto p-2">
        <Command.Empty className="px-4 py-10 text-center text-sm text-muted-foreground">
          No EYLO destination matches this search.
        </Command.Empty>

        {normalizedQuery && (
          <Command.Group heading="Do something with this question" className="command-group [&_[cmdk-group-heading]]:px-3 [&_[cmdk-group-heading]]:pb-1 [&_[cmdk-group-heading]]:pt-3 [&_[cmdk-group-heading]]:text-[9px] [&_[cmdk-group-heading]]:font-semibold [&_[cmdk-group-heading]]:uppercase [&_[cmdk-group-heading]]:tracking-[0.16em] [&_[cmdk-group-heading]]:text-muted-foreground">
            <Command.Item
              value={`research ${normalizedQuery}`}
              onSelect={startResearch}
              className="flex cursor-default items-center gap-3 rounded-xl px-3 py-3 text-sm text-foreground outline-none data-[selected=true]:bg-secondary"
            >
              <span className="grid h-9 w-9 shrink-0 place-items-center rounded-xl bg-primary/10 text-primary">
                <Search size={15} aria-hidden="true" />
              </span>
              <span className="min-w-0 flex-1">
                <span className="block font-semibold">Research “{normalizedQuery}”</span>
                <span className="mt-0.5 block truncate text-[11px] text-muted-foreground">Search live scholarly sources</span>
              </span>
              <CornerDownLeft size={13} className="text-muted-foreground" aria-hidden="true" />
            </Command.Item>

            <Command.Item
              value={`ask eyra ${normalizedQuery}`}
              onSelect={askEyra}
              className="flex cursor-default items-center gap-3 rounded-xl px-3 py-3 text-sm text-foreground outline-none data-[selected=true]:bg-secondary"
            >
              <span className="grid h-9 w-9 shrink-0 place-items-center rounded-xl bg-primary/10 text-primary">
                <Sparkles size={15} aria-hidden="true" />
              </span>
              <span className="min-w-0 flex-1">
                <span className="block font-semibold">Ask EYRA</span>
                <span className="mt-0.5 block truncate text-[11px] text-muted-foreground">Open EYRA with this question ready to edit</span>
              </span>
              <ArrowRight size={13} className="text-muted-foreground" aria-hidden="true" />
            </Command.Item>
          </Command.Group>
        )}

        {groups.map(group => (
          <Command.Group
            key={group.section}
            heading={group.section}
            className="command-group [&_[cmdk-group-heading]]:px-3 [&_[cmdk-group-heading]]:pb-1 [&_[cmdk-group-heading]]:pt-3 [&_[cmdk-group-heading]]:text-[9px] [&_[cmdk-group-heading]]:font-semibold [&_[cmdk-group-heading]]:uppercase [&_[cmdk-group-heading]]:tracking-[0.16em] [&_[cmdk-group-heading]]:text-muted-foreground"
          >
            {group.items.map(item => {
              const Icon = item.icon;
              return (
                <Command.Item
                  key={item.path}
                  value={`${item.label} ${item.desc || ''} ${item.badge || ''} ${group.section}`}
                  onSelect={() => go(item.path)}
                  className="flex cursor-default items-center gap-3 rounded-xl px-3 py-2.5 text-sm text-foreground outline-none data-[selected=true]:bg-secondary"
                >
                  <span className="grid h-8 w-8 shrink-0 place-items-center rounded-lg border border-border bg-background text-muted-foreground">
                    <Icon size={14} aria-hidden="true" />
                  </span>
                  <span className="min-w-0 flex-1">
                    <span className="block truncate text-xs font-semibold">{item.label}</span>
                    {item.desc && <span className="mt-0.5 block truncate text-[10px] text-muted-foreground">{item.desc}</span>}
                  </span>
                  {item.badge && <span className="hidden rounded-md border border-border px-1.5 py-0.5 text-[8px] uppercase tracking-wide text-muted-foreground sm:inline">{item.badge}</span>}
                </Command.Item>
              );
            })}
          </Command.Group>
        ))}
      </Command.List>

      <div className="flex items-center justify-between gap-3 border-t border-border bg-secondary/20 px-4 py-2 text-[9px] text-muted-foreground">
        <span>↑↓ navigate · Enter select · Esc close</span>
        <span>Question → evidence → action</span>
      </div>
    </Command.Dialog>
  );
}
