import React, { useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { ArrowRight, BookOpen, Building2, FlaskConical, Sparkles, Users } from 'lucide-react';

const EXAMPLES = [
  'AI system for early cancer detection',
  'Robotics startup for elderly care',
  'Climate innovation project',
  'Educational AI platform',
];

const CAPABILITIES = [
  { icon: BookOpen, title: 'Scientific literature', text: 'Evidence from OpenAlex, arXiv, Crossref and Europe PMC.' },
  { icon: Users, title: 'Researchers', text: 'Discover real experts, their institutions, work and impact.' },
  { icon: Building2, title: 'Opportunities', text: 'Connect an idea to collaborators, grants and innovation programs.' },
];

export default function Landing() {
  const [idea, setIdea] = useState('');
  const navigate = useNavigate();

  const discover = (event) => {
    event?.preventDefault();
    const query = idea.trim();
    const target = query ? `/discover?q=${encodeURIComponent(query)}` : '/discover';
    navigate(target);
  };

  return (
    <main className="min-h-screen overflow-hidden bg-background text-foreground">
      <header className="relative z-20 mx-auto flex h-20 max-w-7xl items-center justify-between px-5 sm:px-8">
        <Link to="/" className="flex items-center gap-3" aria-label="EYLO home">
          <span className="flex h-10 w-10 items-center justify-center rounded-2xl eyra-gradient text-white shadow-lg">
            <FlaskConical size={19} />
          </span>
          <span>
            <span className="block font-heading text-lg font-bold tracking-tight">EYLO</span>
            <span className="block text-[9px] font-semibold uppercase tracking-[0.22em] text-muted-foreground">Research & Innovation OS</span>
          </span>
        </Link>
        <nav className="flex items-center gap-2">
          <Link to="/login" className="rounded-xl px-4 py-2 text-sm font-medium text-muted-foreground transition-colors hover:text-foreground">Sign in</Link>
          <Link to="/register" className="rounded-xl bg-foreground px-4 py-2 text-sm font-semibold text-background transition-opacity hover:opacity-90">Get started</Link>
        </nav>
      </header>

      <section className="relative px-5 pb-24 pt-16 sm:px-8 sm:pt-24">
        <div className="pointer-events-none absolute left-1/2 top-0 h-[560px] w-[900px] -translate-x-1/2 rounded-full bg-primary/10 blur-[130px]" />
        <div className="relative mx-auto max-w-5xl text-center">
          <div className="mx-auto mb-7 inline-flex items-center gap-2 rounded-full border border-primary/20 bg-primary/5 px-4 py-2 text-xs font-semibold text-primary">
            <Sparkles size={13} /> Meet EYRA — your AI research & innovation co-founder
          </div>
          <h1 className="font-heading text-5xl font-bold tracking-[-0.045em] sm:text-7xl lg:text-8xl">
            Build Research.<br />Build Startups. <span className="eyra-text-gradient">Build Impact.</span>
          </h1>
          <p className="mx-auto mt-7 max-w-3xl text-base leading-7 text-muted-foreground sm:text-xl sm:leading-8">
            Discover researchers. Explore scientific literature. Build projects. Find opportunities. All from a single idea.
          </p>

          <form onSubmit={discover} className="mx-auto mt-12 max-w-3xl rounded-[1.75rem] border border-border/80 bg-card/90 p-2.5 shadow-2xl shadow-primary/10 backdrop-blur">
            <div className="flex items-center gap-2">
              <Sparkles className="ml-4 hidden text-primary sm:block" size={19} />
              <input
                value={idea}
                onChange={(event) => setIdea(event.target.value)}
                placeholder="What would you like to build today?"
                className="min-w-0 flex-1 bg-transparent px-3 py-4 text-base outline-none placeholder:text-muted-foreground/70 sm:text-lg"
                aria-label="Describe what you would like to build"
              />
              <button type="submit" className="flex items-center gap-2 rounded-2xl eyra-gradient px-5 py-4 text-sm font-semibold text-white transition-opacity hover:opacity-90 sm:px-7">
                <span className="hidden sm:inline">Discover with EYRA</span><span className="sm:hidden">Discover</span><ArrowRight size={15} />
              </button>
            </div>
          </form>

          <div className="mx-auto mt-5 flex max-w-3xl flex-wrap justify-center gap-2">
            {EXAMPLES.map((example) => (
              <button key={example} onClick={() => setIdea(example)} className="rounded-full border border-border/70 bg-card/50 px-3 py-1.5 text-xs text-muted-foreground transition-colors hover:border-primary/30 hover:text-foreground">
                {example}
              </button>
            ))}
          </div>
        </div>
      </section>

      <section className="border-y border-border/60 bg-card/30 px-5 py-20 sm:px-8">
        <div className="mx-auto max-w-6xl">
          <div className="mb-10 text-center">
            <p className="text-xs font-bold uppercase tracking-[0.22em] text-primary">One idea. Everything you need.</p>
            <h2 className="mt-3 font-heading text-3xl font-bold sm:text-4xl">From question to evidence to action.</h2>
          </div>
          <div className="grid gap-4 md:grid-cols-3">
            {CAPABILITIES.map(({ icon: Icon, title, text }) => (
              <article key={title} className="rounded-3xl border border-border/70 bg-background/70 p-7">
                <div className="mb-5 flex h-11 w-11 items-center justify-center rounded-2xl bg-primary/10 text-primary"><Icon size={20} /></div>
                <h3 className="font-heading text-lg font-semibold">{title}</h3>
                <p className="mt-2 text-sm leading-6 text-muted-foreground">{text}</p>
              </article>
            ))}
          </div>
        </div>
      </section>
    </main>
  );
}
