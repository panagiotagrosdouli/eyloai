import React from 'react';
import { Mic, MicOff, Send, Loader2, StopCircle } from 'lucide-react';
import { EYRA_MODE_ICONS } from './EyraResearchControls';

/**
 * Conversation-first composer. Authorization and send/stop state stay with the
 * parent Command Center; this component never invokes workspace tools itself.
 */
export default function EyraComposer({
  activeMode, modeLabel, inputRef, value, onChange, onKeyDown,
  onSend, onStop, onStartListening, onStopListening,
  listening, loading, allowWorkspaceActions,
}) {
  const ModeIcon = EYRA_MODE_ICONS[activeMode] || Send;
  return (
    <div className="eyra-composer rounded-2xl border border-border bg-background px-3 pb-2.5 pt-3 shadow-sm transition-shadow focus-within:border-primary/50 focus-within:ring-2 focus-within:ring-primary/15 sm:px-4">
      <label htmlFor="eyra-message-input" className="sr-only">Message EYRA</label>
      <textarea
        id="eyra-message-input"
        ref={inputRef}
        value={value}
        onChange={event => onChange(event.target.value)}
        onKeyDown={onKeyDown}
        aria-label="Message EYRA"
        maxLength={allowWorkspaceActions ? 1000 : 2000}
        placeholder={`Ask EYRA anything about your research…`}
        rows={2}
        className="block max-h-44 min-h-14 w-full resize-y bg-transparent px-2 py-1 text-[15px] leading-7 text-foreground placeholder:text-muted-foreground focus:outline-none sm:text-base"
      />
      <div className="flex items-center justify-between gap-2 border-t border-border/35 px-1 pt-2.5">
        <div className="inline-flex min-w-0 items-center gap-2 rounded-full bg-secondary/60 px-3 py-1.5 text-xs font-medium text-muted-foreground">
          <ModeIcon size={13} aria-hidden="true" />
          <span className="truncate">{modeLabel || 'Research'}</span>
          {allowWorkspaceActions && <span className="font-semibold text-primary">· Tools enabled</span>}
        </div>
        <div className="flex shrink-0 items-center gap-1">
          <button
            type="button"
            onClick={listening ? onStopListening : onStartListening}
            aria-label={listening ? 'Stop voice input' : 'Start voice input'}
            className={`grid min-h-11 min-w-11 place-items-center rounded-xl transition-colors focus-visible:outline focus-visible:outline-2 focus-visible:outline-primary ${listening
              ? 'bg-destructive/10 text-destructive'
              : 'text-muted-foreground hover:bg-secondary'}`}
          >
            {listening ? <MicOff size={17} /> : <Mic size={17} />}
          </button>
          {loading ? (
            <button
              type="button" aria-label="Stop EYRA generation" onClick={onStop}
              className="inline-flex min-h-11 items-center gap-2 rounded-xl border border-border px-3 text-xs font-semibold text-foreground hover:bg-secondary"
            ><StopCircle size={16} /> Stop</button>
          ) : null}
          <button
            type="button" aria-label="Send message" onClick={onSend}
            disabled={!value.trim() || loading}
            className="grid min-h-11 min-w-11 place-items-center rounded-[14px] bg-primary text-primary-foreground shadow-md shadow-primary/25 transition-all hover:-translate-y-0.5 hover:bg-primary/90 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-primary disabled:cursor-not-allowed disabled:opacity-40"
          >
            {loading ? <Loader2 size={17} className="animate-spin" /> : <Send size={17} />}
          </button>
        </div>
      </div>
    </div>
  );
}
