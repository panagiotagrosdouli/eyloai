import React from 'react';
import { motion } from 'framer-motion';
import ReactMarkdown from 'react-markdown';
import { Sparkles, BookOpen, ExternalLink, Check, Copy, BookmarkPlus } from 'lucide-react';
import { EyraOrb } from '@/components/brand/BrandLogo';
import { describeEyraCitedEvidence } from '@/lib/eyra-evidence-status.mjs';

/** Accessible EYRA timeline presentation: evidence cards never claim full-text validation. */
export function TypingIndicator({ stage }) {
  return (
    <div className="flex items-center gap-3 px-1 py-3" role="status" aria-live="polite">
      <div className="grid h-9 w-9 shrink-0 place-items-center rounded-xl border border-primary/15 bg-primary/5 text-primary">
        <Sparkles size={16} />
      </div>
      <div className="flex gap-1 ml-1">
        {[0, 1, 2].map(i => (
          <div key={i} className="w-1.5 h-1.5 rounded-full bg-primary animate-bounce" style={{ animationDelay: `${i * 0.15}s` }} />
        ))}
      </div>
      <span className="text-sm text-muted-foreground">{stage === 'retrieving' ? 'Retrieving live evidence…' : 'Synthesizing a cited answer…'}</span>
    </div>
  );
}

export function Message({ msg, onSave, onCopy, saved, copied, saving }) {
  const isEyra = msg.role === 'eyra';
  const citedEvidence = isEyra ? describeEyraCitedEvidence(msg.sources) : null;
  return (
    <motion.div
      initial={{ opacity: 0, y: 8 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.2 }}
      className={`flex w-full min-w-0 gap-3 sm:gap-4 ${isEyra ? '' : 'flex-row-reverse'}`}
    >
      {isEyra ? (
        <EyraOrb className="mt-0.5 h-9 w-9 shadow-sm shadow-primary/15" />
      ) : (
        <div className="mt-0.5 flex h-9 w-9 shrink-0 items-center justify-center rounded-xl border border-border/70 bg-secondary/70">
          <span className="text-[10px] font-bold text-muted-foreground">You</span>
        </div>
      )}
      <div className={`min-w-0 max-w-[calc(100%_-_3rem)] sm:max-w-[86%] ${isEyra ? 'w-full' : 'items-end flex flex-col'}`}>
        {isEyra && (
          <div className="mb-2 flex items-center gap-2">
            <p className="text-xs font-bold tracking-wide text-foreground">EYRA</p>
            {msg.mode && (
              <span className="rounded-full border border-border/70 bg-secondary/50 px-2 py-0.5 text-[10px] font-semibold capitalize text-muted-foreground">{msg.mode}</span>
            )}
          </div>
        )}
        <div className={`w-full rounded-[20px] px-4 py-4 text-[15px] leading-7 sm:px-5 ${
          isEyra
            ? 'border border-border/60 bg-card/90 text-foreground shadow-sm'
            : 'bg-primary text-primary-foreground shadow-sm'
        }`}>
          {isEyra ? (
            <div className="prose prose-sm max-w-none break-words prose-headings:text-foreground prose-headings:font-semibold prose-p:text-foreground prose-li:text-foreground prose-strong:text-primary prose-p:my-2 prose-p:leading-7 prose-ul:my-3 prose-h2:mb-2 prose-h2:text-base">
              <ReactMarkdown>{msg.content}</ReactMarkdown>
            </div>
          ) : (
            <p>{msg.content}</p>
          )}
        </div>
        {isEyra && msg.retrievalAttempted && citedEvidence?.items.length === 0 && (
          <p role="status" className="mt-2 max-w-full rounded-lg border border-border px-3 py-2 text-xs text-muted-foreground">No retrieved records are linked to this answer. Scientific claims remain unverified; refine your question or check original sources.</p>
        )}
        {isEyra && citedEvidence?.items.length > 0 && (
          <section className="mt-3 max-w-full rounded-2xl border border-border/60 bg-card/60 p-3 sm:p-4" aria-label="EYRA retrieved source records">
            <p className="mb-3 text-xs leading-relaxed text-muted-foreground">
              {citedEvidence.summary}
              {' '}Retrieved records are not independently verified; inspect the original evidence before relying on a scientific claim.
            </p>
            <div className="flex max-w-full flex-wrap gap-1.5">
              {citedEvidence.items.slice(0, 8).map(source => (
                <a
                  key={source.id}
                  href={source.url}
                  target="_blank"
                  rel="noopener noreferrer"
                  title={`${source.kind}: ${source.title}. ${source.scope}`}
                  aria-label={`${source.id} ${source.kind}: ${source.title}. ${source.scope}`}
                  className="inline-flex min-h-9 max-w-full items-center gap-1 rounded-lg border border-border bg-background px-2 py-1 text-xs font-medium text-foreground transition-colors hover:border-primary/35 focus-visible:outline focus-visible:outline-2 focus-visible:outline-primary"
                >
                  <BookOpen size={13} aria-hidden="true" />
                  <span>{source.id}</span>
                  <span className="max-w-44 truncate text-muted-foreground">{source.title}</span>
                  <ExternalLink size={11} aria-hidden="true" />
                </a>
              ))}
              {citedEvidence.items.length > 8 && (
                <span className="self-center px-2 py-1 text-xs text-muted-foreground">
                  +{citedEvidence.items.length - 8} more linked records
                </span>
              )}
            </div>
          </section>
        )}

        <div className="mt-2 flex flex-wrap items-center gap-1 px-1">
          <p className="mr-auto text-xs text-muted-foreground">
            {new Date(msg.timestamp).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
          </p>
          {isEyra && (
            <>
              <button
                type="button"
                onClick={() => onCopy(msg)}
                className="inline-flex min-h-9 items-center gap-1.5 rounded-lg px-2.5 py-1 text-xs text-muted-foreground transition-colors hover:bg-secondary hover:text-foreground focus-visible:outline focus-visible:outline-2 focus-visible:outline-primary"
                aria-label="Copy EYRA response"
              >
                {copied ? <Check size={10} /> : <Copy size={10} />}
                {copied ? 'Copied' : 'Copy'}
              </button>
              <button
                type="button"
                onClick={() => onSave(msg)}
                disabled={saved || saving}
                className="inline-flex min-h-9 items-center gap-1.5 rounded-lg px-2.5 py-1 text-xs text-muted-foreground transition-colors hover:bg-primary/10 hover:text-primary focus-visible:outline focus-visible:outline-2 focus-visible:outline-primary disabled:opacity-70"
                aria-label="Save EYRA response to Idea Vault"
              >
                {saved ? <Check size={10} /> : <BookmarkPlus size={10} />}
                {saved ? 'Saved' : saving ? 'Saving…' : 'Save insight'}
              </button>
            </>
          )}
        </div>
      </div>
    </motion.div>
  );
}

