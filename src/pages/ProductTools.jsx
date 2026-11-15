import React, { useEffect, useState } from "react";
import { ArrowRight, FolderOpen, Search, Sparkles } from "lucide-react";
import { Link, useParams } from "react-router-dom";
import { base44 } from "@/api/base44Client";
import { PRODUCT_TOOLS } from "@/lib/product-registry.mjs";
import PersonalTools from "@/components/products/PersonalTools";
import {
  workspaceInput as input,
  workspaceButton as button,
} from "@/components/projects/ProjectDocumentWorkspace";
export default function ProductTools() {
  const { tool } = useParams();
  const config = PRODUCT_TOOLS.find((p) => p.slug === tool);
  if (!tool) return <ToolsDirectory />;
  if (!config) return <main className="eylo-page">Unknown tool.</main>;
  return config.kind === "project" || config.kind === "personal-project" ? (
    <ProjectChooser key={tool} config={config} />
  ) : (
    <PersonalTools key={tool} tool={tool} />
  );
}

// Group tools by the outcome users want, not their implementation details.
const TOOL_CATEGORIES = [
  { id: "all", label: "All tools" },
  { id: "research", label: "Research" },
  { id: "projects", label: "Projects & work" },
  { id: "create", label: "Create & learn" },
  { id: "people", label: "People & teams" },
  { id: "advanced", label: "Advanced" },
];

const TOOL_CATEGORY_BY_SLUG = {
  methodology: "research", ethics: "research", conferences: "research",
  "peer-review": "research", memory: "research",
  spaces: "projects", workflows: "projects", business: "projects",
  offline: "projects", forms: "projects",
  skills: "create", interview: "create", spreadsheets: "create",
  translate: "create", studio: "create",
  teams: "people", connect: "people", community: "people",
  feedback: "people",
  admin: "advanced", "self-healing": "advanced", developer: "advanced",
};

const FRIENDLY_TOOL_DESCRIPTIONS = {
  memory: "Find information in your saved notes, projects and EYRA conversations.",
  workflows: "Turn a plan into organized tasks.",
  studio: "Write a creative brief and save it to your notes.",
  spreadsheets: "Work with tables, formulas and data.",
  business: "Review project costs, time and progress.",
  offline: "View encrypted workspace snapshots without a connection.",
  "self-healing": "Check and troubleshoot workspace issues.",
  developer: "Manage access tokens for developer integrations.",
  forms: "Create forms and collect project responses.",
};

function toolPath(item) {
  return item.kind === "offline"
    ? "/offline"
    : item.kind === "collaboration"
      ? `/collaboration/${item.slug}`
      : `/tools/${item.slug}`;
}

function ToolsDirectory() {
  const [query, setQuery] = useState("");
  const [category, setCategory] = useState("all");
  const normalized = query.trim().toLocaleLowerCase();
  const results = PRODUCT_TOOLS.filter(item => {
    const inCategory = category === "all" || TOOL_CATEGORY_BY_SLUG[item.slug] === category;
    const keywords = `${item.title} ${item.description} ${FRIENDLY_TOOL_DESCRIPTIONS[item.slug] || ""}`.toLocaleLowerCase();
    return inCategory && (!normalized || keywords.includes(normalized));
  });

  return (
    <main className="eylo-page mx-auto max-w-6xl space-y-7">
      <header className="max-w-3xl space-y-2">
        <p className="text-xs font-semibold uppercase tracking-[0.14em] text-primary">Your workspace</p>
        <h1 className="text-3xl font-bold tracking-tight text-foreground">What would you like to do?</h1>
        <p className="text-sm leading-relaxed text-muted-foreground">
          Find the right EYLO tool for your next step. You can search by name or what you want to accomplish.
        </p>
      </header>

      <section aria-label="Common starting points" className="grid gap-3 sm:grid-cols-3">
        <Link to="/search" className="group flex min-h-24 items-start gap-3 rounded-xl border border-border bg-card p-4 transition-colors hover:border-primary/40 hover:bg-secondary/40 focus-visible:outline focus-visible:outline-2 focus-visible:outline-primary">
          <Search className="mt-1 shrink-0 text-primary" size={20} aria-hidden="true" />
          <span><strong className="block text-sm text-foreground">Explore research</strong><span className="mt-1 block text-xs leading-relaxed text-muted-foreground">Find scientific publications and evidence.</span></span>
          <ArrowRight className="ml-auto shrink-0 text-muted-foreground group-hover:text-primary" size={16} aria-hidden="true" />
        </Link>
        <Link to="/projects" className="group flex min-h-24 items-start gap-3 rounded-xl border border-border bg-card p-4 transition-colors hover:border-primary/40 hover:bg-secondary/40 focus-visible:outline focus-visible:outline-2 focus-visible:outline-primary">
          <FolderOpen className="mt-1 shrink-0 text-primary" size={20} aria-hidden="true" />
          <span><strong className="block text-sm text-foreground">Continue a project</strong><span className="mt-1 block text-xs leading-relaxed text-muted-foreground">Open your research workspace.</span></span>
          <ArrowRight className="ml-auto shrink-0 text-muted-foreground group-hover:text-primary" size={16} aria-hidden="true" />
        </Link>
        <Link to="/learn" className="group flex min-h-24 items-start gap-3 rounded-xl border border-border bg-card p-4 transition-colors hover:border-primary/40 hover:bg-secondary/40 focus-visible:outline focus-visible:outline-2 focus-visible:outline-primary">
          <Sparkles className="mt-1 shrink-0 text-primary" size={20} aria-hidden="true" />
          <span><strong className="block text-sm text-foreground">Study something</strong><span className="mt-1 block text-xs leading-relaxed text-muted-foreground">Continue a learning path.</span></span>
          <ArrowRight className="ml-auto shrink-0 text-muted-foreground group-hover:text-primary" size={16} aria-hidden="true" />
        </Link>
      </section>

      <section aria-label="Browse EYLO tools" className="space-y-4">
        <div className="flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between">
          <div>
            <h2 className="text-xl font-semibold text-foreground">Explore all tools</h2>
            <p className="mt-1 text-sm text-muted-foreground">Browse by goal or find a specific tool.</p>
          </div>
          <label className="relative block sm:w-80">
            <span className="sr-only">Search tools</span>
            <Search className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground" size={17} aria-hidden="true" />
            <input type="search" value={query} onChange={event => setQuery(event.target.value)}
              placeholder="Search tools or tasks…" className="min-h-11 w-full rounded-xl border border-border bg-background pl-10 pr-3 text-sm text-foreground outline-none placeholder:text-muted-foreground focus-visible:ring-2 focus-visible:ring-primary" />
          </label>
        </div>
        <div className="flex gap-2 overflow-x-auto pb-1" role="group" aria-label="Filter tools by category">
          {TOOL_CATEGORIES.map(item => (
            <button key={item.id} type="button" onClick={() => setCategory(item.id)}
              aria-pressed={category === item.id}
              className={`min-h-10 shrink-0 rounded-full border px-4 text-sm font-medium transition-colors focus-visible:outline focus-visible:outline-2 focus-visible:outline-primary ${category === item.id ? "border-primary bg-primary text-primary-foreground" : "border-border bg-card text-muted-foreground hover:bg-secondary hover:text-foreground"}`}>
              {item.label}
            </button>
          ))}
        </div>
        <p role="status" aria-live="polite" className="text-xs text-muted-foreground">
          {results.length} {results.length === 1 ? "tool" : "tools"} available in this view
        </p>
        {results.length ? (
          <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
            {results.map(item => (
              <Link key={item.id} to={toolPath(item)}
                className="group flex min-h-32 flex-col justify-between gap-3 rounded-xl border border-border bg-card p-4 transition-colors hover:border-primary/40 hover:bg-secondary/30 focus-visible:outline focus-visible:outline-2 focus-visible:outline-primary">
                <div>
                  <h3 className="font-semibold text-foreground">{item.title}</h3>
                  <p className="mt-2 text-sm leading-relaxed text-muted-foreground">{FRIENDLY_TOOL_DESCRIPTIONS[item.slug] || item.description}</p>
                </div>
                <span className="inline-flex items-center gap-1 text-xs font-medium text-primary">Open tool <ArrowRight size={14} aria-hidden="true" /></span>
              </Link>
            ))}
          </div>
        ) : (
          <div className="rounded-xl border border-dashed border-border px-6 py-12 text-center">
            <p className="font-semibold text-foreground">No matching tools</p>
            <p className="mt-1 text-sm text-muted-foreground">Try a different search or explore all categories.</p>
            <button type="button" onClick={() => { setQuery(""); setCategory("all"); }}
              className="mt-4 min-h-10 rounded-lg border border-border px-4 text-sm font-medium hover:bg-secondary focus-visible:outline focus-visible:outline-2 focus-visible:outline-primary">
              Clear filters
            </button>
          </div>
        )}
      </section>
    </main>
  );
}

function ProjectChooser({ config }) {
  const [projects, setProjects] = useState([]),
    [selected, setSelected] = useState(""),
    [error, setError] = useState(""),
    [loading, setLoading] = useState(true);
  useEffect(() => {
    let active = true;
    void base44.entities.Project.list("-updated_date", 1000)
      .then((rows) => {
        if (active) setProjects(rows);
      })
      .catch(() => {
        if (active) setError("Private projects could not be loaded.");
      })
      .finally(() => {
        if (active) setLoading(false);
      });
    return () => {
      active = false;
    };
  }, []);
  return (
    <main className="eylo-page mx-auto max-w-3xl space-y-5">
      <Link to="/tools">All tools</Link>
      <h1 className="text-2xl font-bold">{config.title}</h1>
      <p>{config.description}</p>
      {error && <p role="alert">{error}</p>}
      {loading && <p role="status">Loading private projects…</p>}
      <label className="block text-sm">
        Private project
        <select
          className={input}
          value={selected}
          onChange={(e) => setSelected(e.target.value)}
        >
          <option value="">Choose a project</option>
          {projects.map((p) => (
            <option key={p.id} value={p.id}>
              {p.title}
            </option>
          ))}
        </select>
      </label>
      {selected && (
        <Link
          className={button}
          to={
            config.slug === "spreadsheets"
              ? `/projects/${selected}/spreadsheet`
              : `/projects/${selected}/workbench/${config.slug}`
          }
        >
          Open {config.title}
        </Link>
      )}
      <Link className="block text-sm text-primary" to="/projects">
        Create or manage projects
      </Link>
    </main>
  );
}
