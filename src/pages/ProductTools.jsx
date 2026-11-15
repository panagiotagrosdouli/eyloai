import React, { useEffect, useMemo, useState } from "react";
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
  if (!tool) return <ToolDirectory />;
  if (!config) return <main className="eylo-page">Unknown tool.</main>;
  return config.kind === "project" || config.kind === "personal-project" ? (
    <ProjectChooser key={tool} config={config} />
  ) : (
    <PersonalTools key={tool} tool={tool} />
  );
}

const DIRECT_TOOLS = [
  { slug: 'thesis-studio', title: 'Organize my thesis', description: 'Open a research project to plan thesis writing and evidence.', href: '/projects', category: 'Research' },
  { slug: 'paper-summary', title: 'Understand a scientific paper', description: 'Open saved publications and request evidence-aware help from EYRA.', href: '/library', category: 'Research' },
  { slug: 'study-plan-goal', title: 'Make a study plan', description: 'Schedule courses, reading and exam preparation.', href: '/study-planner', category: 'Learning' },
  { slug: 'document-editor', title: 'Create document', description: 'Write and save a research document.', href: '/documents/new', category: 'Workspace' },
  { slug: 'workspace-search', title: 'Search my workspace', description: 'Find saved notes, projects and research.', href: '/workspace/search', category: 'Workspace' },
  { slug: 'time-tracker', title: 'Time tracker', description: 'Track time spent on project work.', href: '/time-tracker', category: 'Workspace' },
  { slug: 'life-tasks', title: 'Tasks and priorities', description: 'Keep personal and project-linked tasks organized.', href: '/life', category: 'Workspace' },
  { slug: 'goals', title: 'Goals', description: 'Set and review milestones for longer-term goals.', href: '/life/goals', category: 'Workspace' },
  { slug: 'habits', title: 'Habits', description: 'Maintain and review recurring routines.', href: '/habits', category: 'Workspace' },
  { slug: 'history', title: 'Discovery history', description: 'Return to earlier research searches.', href: '/history', category: 'Research' },
  { slug: 'activity', title: 'Activity history', description: 'Review changes to private workspace records.', href: '/activity', category: 'Workspace' },
  { slug: 'saved-ideas', title: 'Idea workspace', description: 'Capture and develop research ideas.', href: '/ideas', category: 'Workspace' },
  { slug: 'for-you', title: 'For you', description: 'Review updates informed by saved research context.', href: '/foryou', category: 'Research' },
  { slug: 'careers', title: 'Research careers', description: 'Explore academic and research roles.', href: '/workspace/careers', category: 'Funding' },
  { slug: 'challenges', title: 'Open challenges', description: 'Discover research and innovation challenges.', href: '/challenges', category: 'Funding' },
  { slug: 'executive-briefing', title: 'Executive briefing', description: 'Review a sourced summary of priorities and risks.', href: '/briefing', category: 'Specialized tools' },
  { slug: 'scenario-planner', title: 'Scenario planner', description: 'Compare possible future project directions.', href: '/labs/scenario', category: 'Specialized tools' },
  { slug: 'professional-path', title: 'Professional path', description: 'Plan professional development.', href: '/labs/professional-path', category: 'Specialized tools' },
  { slug: 'research-landscape', title: 'Research landscape', description: 'Compare approaches and evidence gaps.', href: '/labs/research-landscape', category: 'Research' },
  { slug: 'team-planner', title: 'Team planner', description: 'Explore roles and collaboration fit.', href: '/labs/team', category: 'Collaboration' },
  { slug: 'impact-review', title: 'Impact review', description: 'Test research impact assumptions.', href: '/labs/impact', category: 'Research' },
  { slug: 'voice-workspace', title: 'Voice workspace', description: 'Dictate a research question.', href: '/labs/voice', category: 'Specialized tools' },
  { slug: 'pitch-deck', title: 'Pitch deck builder', description: 'Prepare a sourced presentation.', href: '/pitchdeck', category: 'Specialized tools' },
  { slug: 'institution', title: 'Institution analytics', description: 'Review permitted institutional workspace activity.', href: '/institution', category: 'Specialized tools' },
  { slug: 'notifications', title: 'Notifications', description: 'Review your recent workspace notifications.', href: '/notifications', category: 'Workspace' },
  { slug: 'settings', title: 'Settings', description: 'Adjust preferences, accessibility and access.', href: '/settings', category: 'Specialized tools' },
  { slug: 'profile', title: 'Profile', description: 'Manage your research identity and interests.', href: '/profile', category: 'Workspace' },
  { slug: 'plans', title: 'Plans and access', description: 'Review subscription and feature availability.', href: '/pricing', category: 'Specialized tools' },
  { slug: 'meeting-workflows', title: 'Task workflows', description: 'Review stored workflows and run history.', href: '/automations', category: 'Workspace' },
  { slug: 'research-discovery', title: 'Research discovery', description: 'Find publications and examine source evidence.', href: '/search', category: 'Research' },
  { slug: 'literature-review', title: 'Literature review protocol', description: 'Plan, screen and document a reproducible review.', href: '/literature-review', category: 'Research' },
  { slug: 'research-gaps', title: 'Research gap finder', description: 'Compare saved studies and examine evidence gaps.', href: '/research-gaps', category: 'Research' },
  { slug: 'data-lab', title: 'Research Data Lab', description: 'Analyze CSV data privately in your browser.', href: '/labs/data', category: 'Research' },
  { slug: 'knowledge-graph', title: 'Knowledge graph', description: 'Explore connections supported by saved research.', href: '/knowledge-graph', category: 'Research' },
  { slug: 'researchers', title: 'Find researchers', description: 'Identify potential collaborators from their work.', href: '/researchers', category: 'Research' },
  { slug: 'funding', title: 'Funding and calls', description: 'Find opportunities and check their official source.', href: '/opportunities', category: 'Funding' },
  { slug: 'grant-builder', title: 'Grant workspace', description: 'Prepare and track research grant applications.', href: '/grant-builder', category: 'Funding' },
  { slug: 'opportunity-radar', title: 'Opportunity review', description: 'Compare funding options against project context.', href: '/radar', category: 'Funding' },
  { slug: 'projects', title: 'Projects', description: 'Keep your research tasks, records and evidence together.', href: '/projects', category: 'Workspace' },
  { slug: 'library', title: 'Library', description: 'Return to saved papers, researchers and opportunities.', href: '/library', category: 'Workspace' },
  { slug: 'notes', title: 'Notes', description: 'Capture ideas and link notes to projects.', href: '/notes', category: 'Workspace' },
  { slug: 'files', title: 'Files', description: 'Organize research files with version history.', href: '/files', category: 'Workspace' },
  { slug: 'meetings', title: 'Meetings', description: 'Capture decisions and follow-up actions.', href: '/meetings', category: 'Workspace' },
  { slug: 'calendar', title: 'Calendar', description: 'Manage study sessions, events and deadlines.', href: '/calendar', category: 'Workspace' },
  { slug: 'study-planner', title: 'Study planner', description: 'Plan study sessions, courses and exams.', href: '/study-planner', category: 'Learning' },
  { slug: 'learn', title: 'Learn', description: 'Continue lessons and saved learning paths.', href: '/learn', category: 'Learning' },
  { slug: 'flashcards', title: 'Flashcards', description: 'Practice recall with saved study cards.', href: '/flashcards', category: 'Learning' },
  { slug: 'quiz-generator', title: 'Quiz generator', description: 'Create and review self-assessment quizzes.', href: '/quiz-generator', category: 'Learning' },
];
const toolHref = item => item.href || (item.kind === 'offline' ? '/offline' : item.kind === 'collaboration' ? '/collaboration/' + item.slug : '/tools/' + item.slug);
const toolCategory = item => item.category || (item.kind === 'collaboration' ? 'Collaboration' : item.kind === 'project' || item.kind === 'personal-project' ? 'Workspace' : 'Specialized tools');
const INTENT_ALIASES = {
  'research-discovery': 'research topic paper scientific publication scholarly article find literature',
  'paper-summary': 'explain understand summarize analyse analyze scientific paper study reading article',
  'literature-review': 'systematic review prisma screening evidence synthesis methods',
  'thesis-studio': 'dissertation doctoral thesis masters proposal organize write plan',
  'research-gaps': 'find gaps missing evidence research question',
  'grant-builder': 'funding application grant proposal write',
  funding: 'call scholarships grants research funding opportunities',
  'study-plan-goal': 'need a study plan schedule studying',
  'study-planner': 'study plan exams syllabus course timetable',
  'knowledge-graph': 'concept map network related papers',
  'data-lab': 'csv dataset statistics analysis',
  'projects': 'create research project start project',
};
const SEARCH_STOPWORDS = new Set(['i','a','an','the','to','for','my','me','want','need','would','like','how','do','can','please','help','with','some','and','of','on','in']);
function matchesIntent(item, rawQuery) {
  const query = rawQuery.trim().toLowerCase();
  if (!query) return true;
  const haystack = [item.title, item.description, item.category, item.slug, INTENT_ALIASES[item.slug] || ''].join(' ').toLowerCase();
  if (haystack.includes(query)) return true;
  const terms = query.replace(/[^\\p{L}\\p{N}]+/gu, ' ').split(' ').filter(term => term.length > 1 && !SEARCH_STOPWORDS.has(term));
  return terms.length > 0 && terms.every(term => haystack.includes(term));
}

const DIRECTORY = [...DIRECT_TOOLS, ...PRODUCT_TOOLS.map(item => ({ ...item, category: toolCategory(item) }))];
const CATEGORIES = ['All', 'Research', 'Workspace', 'Learning', 'Funding', 'Collaboration', 'Specialized tools'];

function ToolDirectory() {
  const [query, setQuery] = useState('');
  const [category, setCategory] = useState('All');
  const matches = useMemo(() => DIRECTORY.filter(item =>
    (category === 'All' || item.category === category)
    && matchesIntent(item, query)
  ), [query, category]);

  return (
    <div className="eylo-page mx-auto max-w-6xl">
      <h1 className="eylo-page-heading">All tools</h1>
      <p className="mt-3 max-w-2xl text-sm leading-6 text-muted-foreground">Find the right workflow for your goal. Existing project and research tools remain available here.</p>
      <div className="mt-6">
        <label htmlFor="tool-directory-search" className="mb-2 block text-sm font-medium">Find a tool or task</label>
        <input id="tool-directory-search" type="search" value={query} onChange={event => setQuery(event.target.value)}
          placeholder="Try literature review, study plan, funding…" className="min-h-12 w-full rounded-xl border border-border bg-card px-4 text-base text-foreground" />
      </div>
      <div role="group" aria-label="Tool category" className="mt-4 flex flex-wrap gap-2">
        {CATEGORIES.map(name => <button key={name} type="button" onClick={() => setCategory(name)} aria-pressed={category === name}
          className={`min-h-11 rounded-xl border px-4 text-sm font-medium transition-colors ${category === name ? 'border-primary bg-primary text-primary-foreground' : 'border-border bg-card text-foreground hover:bg-secondary'}`}>{name}</button>)}
      </div>
      <p role="status" className="mt-6 text-xs text-muted-foreground">{matches.length} {matches.length === 1 ? 'tool' : 'tools'} available</p>
      {matches.length ? <div className="mt-3 grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
        {matches.map(item => <Link key={item.slug + ':' + item.category} to={toolHref(item)}
          className="group flex min-h-36 flex-col rounded-xl border border-border bg-card p-5 transition-colors hover:border-primary/40 hover:bg-secondary/30">
          <span className="text-xs font-semibold text-primary">{item.category}</span>
          <h2 className="mt-2 text-base font-semibold text-foreground group-hover:text-primary">{item.title}</h2>
          <p className="mt-2 flex-1 text-sm leading-6 text-muted-foreground">{item.description}</p>
          <span className="mt-3 text-sm font-semibold text-primary">Open tool <span aria-hidden="true">→</span></span>
        </Link>)}
      </div> : <div className="mt-4 rounded-xl border border-dashed border-border bg-card p-8 text-center">
        <h2 className="text-base font-semibold">No tools found</h2>
        <p className="mt-2 text-sm text-muted-foreground">Try another term or clear the category filter.</p>
        <button type="button" onClick={() => { setQuery(''); setCategory('All'); }} className="mt-4 min-h-11 rounded-lg bg-primary px-4 text-sm font-semibold text-primary-foreground">Show all tools</button>
      </div>}
    </div>
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
