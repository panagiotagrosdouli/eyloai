import React, { useState } from 'react';
import { Link } from 'react-router-dom';

const HOME_PATHS = [
  { id: 'ask', label: 'Ask & explore', intro: 'Explore a question and choose how to continue.', examples: [
    { label: 'My projects', to: '/projects', desc: 'Resume your saved work' },
    { label: 'Explore research', to: '/search', desc: 'Find source-linked scholarly evidence' },
    { label: 'Learn something new', to: '/learn', desc: 'Open learning activities' },
  ] },
  { id: 'create', label: 'Create & learn', intro: 'Turn ideas into documents and learning projects.', examples: [
    { label: 'Create a document', to: '/documents/new', desc: 'Draft content in your workspace' },
    { label: 'My learning tools', to: '/learn', desc: 'Explore learning and study' },
    { label: 'Save my ideas', to: '/projects', desc: 'Keep work connected to a project' },
  ] },
  { id: 'plan', label: 'Plan & organize', intro: 'Keep priorities and next steps together.', examples: [
    { label: 'My projects', to: '/projects', desc: 'Organize ongoing work' },
    { label: 'My tasks', to: '/life', desc: 'Track priorities and reminders' },
    { label: 'My calendar', to: '/calendar', desc: 'See upcoming plans' },
  ] },
  { id: 'research', label: 'Research & evidence', intro: 'Explore scientific sources and build a research workflow.', examples: [
    { label: 'Find papers', to: '/search', desc: 'Check source-linked research records' },
    { label: 'Find researchers', to: '/researchers', desc: 'Explore authors and experts' },
    { label: 'Research library', to: '/library', desc: 'Revisit saved literature' },
  ] },
];

export default function GoalPaths() {
  const [audience, setAudience] = useState('ask');
  const selected = HOME_PATHS.find(item => item.id === audience) || HOME_PATHS[0];
  return <section aria-labelledby="goal-path-title" className="eylo-page mx-auto max-w-7xl pb-7">
    <div className="rounded-2xl border border-border bg-card p-5 sm:p-7">
      <p className="text-xs font-bold uppercase tracking-widest text-primary">Your workspace, your goals</p>
      <h2 id="goal-path-title" className="mt-2 text-xl font-semibold sm:text-2xl">What would you like to do today?</h2>
      <p className="mt-2 text-sm leading-6 text-muted-foreground">Choose a starting point. You can change it any time; this does not update your account profile.</p>
      <div className="mt-5 flex flex-wrap gap-2" role="group" aria-label="Choose what you want to do">
        {HOME_PATHS.map(item => <button key={item.id} type="button" aria-pressed={audience === item.id} onClick={() => setAudience(item.id)} className={`min-h-11 rounded-xl border px-4 text-sm font-semibold ${audience === item.id ? 'border-primary bg-primary/10 text-primary' : 'border-border text-foreground hover:bg-secondary'}`}>{item.label}</button>)}
      </div>
      <p className="mt-5 text-sm text-muted-foreground">{selected.intro}</p>
      <div className="mt-4 grid gap-3 md:grid-cols-3">
        {selected.examples.map(item => <Link key={item.to} to={item.to} className="group flex min-h-28 flex-col rounded-xl border border-border bg-background p-4 hover:border-primary/50">
          <span className="text-sm font-semibold">{item.label}</span>
          <span className="mt-2 flex-1 text-xs leading-5 text-muted-foreground">{item.desc}</span>
          <span className="mt-3 text-xs font-semibold text-primary">Open feature →</span>
        </Link>)}
      </div>
    </div>
  </section>;
}

