import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { Link } from 'react-router-dom';
import { AlertTriangle, BookOpen, CircleHelp, Minus, Plus, RefreshCw, RotateCcw, Search } from 'lucide-react';
import { base44 } from '@/api/base44Client';
import { useAuth } from '@/lib/AuthContext';
import { loadResearchGraphCollections } from '@/lib/research-graph-collections.mjs';
import {
  buildResearchKnowledgeGraph,
  filterResearchKnowledgeGraph,
  getRelatedKnowledgeNodes,
  selectResearchGraphNodes,
} from '@/lib/research-knowledge-graph.mjs';

const NODE_TYPES = [
  ['project', 'Projects'],
  ['note', 'Notes'],
  ['task', 'Tasks'],
  ['paper', 'Publications'],
  ['researcher', 'Researchers'],
  ['author', 'Publication authors'],
  ['institution', 'Institutions'],
  ['topic', 'Indexed topics'],
  ['methodology', 'Researcher method notes'],
];

const TYPE_COLORS = {
  project: '#1d5f91',
  note: '#65769c',
  task: '#367d82',
  paper: '#3479ad',
  researcher: '#58815d',
  author: '#4c8b78',
  institution: '#826ca5',
  topic: '#b17a37',
  methodology: '#9a5d72',
};

const TYPE_LABELS = Object.fromEntries(NODE_TYPES);
const GRAPH_BOUNDS = { width: 1000, height: 700 };
const MAX_DRAWN_NODES = 120;

function graphLayout(nodes) {
  const groups = new Map();
  for (const node of nodes) {
    if (!groups.has(node.type)) groups.set(node.type, []);
    groups.get(node.type).push(node);
  }
  const positions = new Map();
  const innerTypes = ['project'];
  const paperTypes = ['paper', 'note', 'task'];
  const authorTypes = ['author', 'researcher'];
  const outerTypes = ['institution', 'topic', 'methodology'];
  const layers = [
    { types: innerTypes, radius: 92 },
    { types: paperTypes, radius: 208 },
    { types: authorTypes, radius: 330 },
    { types: outerTypes, radius: 440 },
  ];
  for (const layer of layers) {
    const members = layer.types.flatMap(type => groups.get(type) || []);
    members.sort((left, right) => left.label.localeCompare(right.label));
    members.forEach((node, index) => {
      const angle = members.length === 1 ? -Math.PI / 2 : (2 * Math.PI * index / members.length) - Math.PI / 2;
      positions.set(node.id, {
        x: GRAPH_BOUNDS.width / 2 + Math.cos(angle) * layer.radius,
        y: GRAPH_BOUNDS.height / 2 + Math.sin(angle) * layer.radius,
      });
    });
  }
  return positions;
}

function NodeGlyph({ node, position, selected, onSelect }) {
  const activate = event => {
    if (event.key === 'Enter' || event.key === ' ') {
      event.preventDefault();
      onSelect(node);
    }
  };
  const color = TYPE_COLORS[node.type] || '#486581';
  return (
    <g
      data-graph-node="true"
      role="button"
      tabIndex={0}
      aria-label={`Explore graph node: ${node.label} (${TYPE_LABELS[node.type] || node.type})`}
      aria-pressed={selected}
      onPointerDown={event => event.stopPropagation()}
      onClick={() => onSelect(node)}
      onKeyDown={activate}
      className="cursor-pointer outline-none"
    >
      <circle cx={position.x} cy={position.y} r={selected ? 14 : 11} fill={color} stroke={selected ? '#102b49' : '#ffffff'} strokeWidth={selected ? 4 : 2} />
      <text x={position.x} y={position.y + 27} textAnchor="middle" className="fill-foreground text-[11px] font-medium" paintOrder="stroke" stroke="var(--background)" strokeWidth="4" strokeLinejoin="round">
        {node.label.length > 26 ? `${node.label.slice(0, 25)}…` : node.label}
      </text>
    </g>
  );
}

function EdgeLine({ edge, positions }) {
  const from = positions.get(edge.from);
  const to = positions.get(edge.to);
  if (!from || !to) return null;
  const stroke = edge.inferred ? '#b17a37' : '#7b93a8';
  return (
    <line
      x1={from.x}
      y1={from.y}
      x2={to.x}
      y2={to.y}
      stroke={stroke}
      strokeWidth={edge.inferred ? 1.6 : 1.2}
      strokeDasharray={edge.inferred ? '5 5' : undefined}
      opacity={edge.inferred ? 0.75 : 0.5}
    />
  );
}

export default function ResearchKnowledgeGraph() {
  const { user } = useAuth();
  return <PrivateResearchKnowledgeGraph key={user?.id || 'signed-out'} ownerId={user?.id || ''} />;
}

function PrivateResearchKnowledgeGraph({ ownerId }) {
  const [graph, setGraph] = useState(() => buildResearchKnowledgeGraph());
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState('');
  const [partialNotice, setPartialNotice] = useState('');
  const [query, setQuery] = useState('');
  const [types, setTypes] = useState(null);
  const [selectedNode, setSelectedNode] = useState(null);
  const [zoom, setZoom] = useState(1);
  const [pan, setPan] = useState({ x: 0, y: 0 });
  const svgRef = useRef(null);
  const dragRef = useRef(null);
  const generation = useRef(0);

  const loadGraph = useCallback(async () => {
    const request = ++generation.current;
    setLoading(true);
    setLoadError('');
    setPartialNotice('');
    setGraph(buildResearchKnowledgeGraph());
    setSelectedNode(null);
    try {
      const result = await loadResearchGraphCollections({ entities: base44.entities, ownerId });
      if (generation.current !== request) return;
      if (result.allUnavailable) throw new Error('Unavailable graph');
      const labels = { papers: 'publications', researchers: 'researchers', projects: 'projects', notes: 'Notes', tasks: 'tasks' };
      const messages = ['Coverage is limited to your saved library, projects, active Notes and tasks. Only explicit saved links connect workspace records.'];
      if (result.unavailable.length) messages.push(`Unavailable collections: ${result.unavailable.map(name => labels[name]).join(', ')}. Use Refresh graph to retry.`);
      if (result.truncated.length) messages.push(`Showing at most 250 recent records per collection; more exist in ${result.truncated.map(name => labels[name]).join(', ')}.`);
      setPartialNotice(messages.join(' '));
      setGraph(buildResearchKnowledgeGraph(result.collections));
    } catch {
      if (generation.current === request) setLoadError('Your saved research could not be loaded. Retry when your connection is available.');
    } finally {
      if (generation.current === request) setLoading(false);
    }
  }, [ownerId]);

  useEffect(() => { void loadGraph(); return () => { generation.current += 1; }; }, [loadGraph]);

  const filtered = useMemo(() => filterResearchKnowledgeGraph(graph, { query, types }), [graph, query, types]);
  const drawnNodes = useMemo(() => selectResearchGraphNodes(filtered.nodes, MAX_DRAWN_NODES), [filtered.nodes]);
  const drawnIds = useMemo(() => new Set(drawnNodes.map(node => node.id)), [drawnNodes]);
  const drawnEdges = useMemo(() => filtered.edges.filter(edge => drawnIds.has(edge.from) && drawnIds.has(edge.to)), [filtered.edges, drawnIds]);
  const positions = useMemo(() => graphLayout(drawnNodes), [drawnNodes]);
  const selected = selectedNode ? graph.nodes.find(node => node.id === selectedNode.id) || null : null;
  const related = selected ? getRelatedKnowledgeNodes(graph, selected.id) : [];
  const hasSources = graph.nodes.length > 0;

  const changeType = (type, checked) => {
    setTypes(current => {
      const currentTypes = current || NODE_TYPES.map(([value]) => value);
      const next = checked ? [...new Set([...currentTypes, type])] : currentTypes.filter(value => value !== type);
      return next.length === NODE_TYPES.length ? null : next;
    });
  };

  const handlePointerDown = event => {
    if (event.target.closest?.('[data-graph-node="true"]')) return;
    const rect = svgRef.current?.getBoundingClientRect();
    if (!rect) return;
    dragRef.current = {
      x: event.clientX,
      y: event.clientY,
      panX: pan.x,
      panY: pan.y,
      scaleX: GRAPH_BOUNDS.width / rect.width,
      scaleY: GRAPH_BOUNDS.height / rect.height,
    };
    event.currentTarget.setPointerCapture(event.pointerId);
  };
  const handlePointerMove = event => {
    if (!dragRef.current) return;
    setPan({
      x: dragRef.current.panX + (event.clientX - dragRef.current.x) * dragRef.current.scaleX,
      y: dragRef.current.panY + (event.clientY - dragRef.current.y) * dragRef.current.scaleY,
    });
  };
  const finishPan = () => { dragRef.current = null; };

  return (
    <div className="eylo-page">
      <header className="mb-6 flex flex-wrap items-end justify-between gap-4">
        <div>
          <p className="text-xs font-semibold uppercase tracking-[0.16em] text-primary">Research workspace</p>
          <h1 className="eylo-page-heading mt-2">Knowledge Graph</h1>
          <p className="mt-3 max-w-2xl text-sm leading-6 text-muted-foreground">Connect your saved publications, researchers, projects, Notes and tasks. Inspect the recorded source or workspace link behind each relationship.</p>
        </div>
        <button type="button" onClick={loadGraph} disabled={loading} className="inline-flex min-h-10 items-center gap-2 rounded-xl border border-border bg-card px-4 text-sm font-semibold text-foreground hover:border-primary/30 disabled:opacity-50">
          <RefreshCw size={15} aria-hidden="true" className={loading ? 'animate-spin' : ''} /> Refresh graph
        </button>
      </header>

      {partialNotice && <p role="status" className="mb-4 rounded-xl border border-border bg-card px-4 py-3 text-xs leading-5 text-muted-foreground">{partialNotice}</p>}
      {loadError && <div role="alert" className="mb-5 flex flex-wrap items-center justify-between gap-3 rounded-xl border border-destructive/30 bg-destructive/5 px-4 py-3 text-sm"><span>{loadError}</span><button type="button" onClick={loadGraph} className="font-semibold text-primary underline">Retry</button></div>}

      {!loading && !loadError && !hasSources && (
        <section className="eylo-surface mb-5 px-6 py-10 text-center">
          <BookOpen size={25} className="mx-auto text-primary" aria-hidden="true" />
          <h2 className="mt-3 text-lg font-semibold">Start with your saved research</h2>
          <p className="mx-auto mt-2 max-w-lg text-sm text-muted-foreground">Save papers or researchers in your Library and link them to projects. The graph will use source IDs and saved links; it will not invent citation or identity matches.</p>
          <div className="mt-5 flex flex-wrap justify-center gap-3">
            <Link to="/library" className="inline-flex min-h-10 items-center rounded-lg border border-border px-4 text-sm font-semibold">Open Library</Link>
            <Link to="/search" className="inline-flex min-h-10 items-center rounded-lg bg-primary px-4 text-sm font-semibold text-primary-foreground">Find papers</Link>
          </div>
        </section>
      )}

      {!loading && graph.nodes.length > 0 && (
        <>
          <div className="mb-4 grid gap-3 sm:grid-cols-3" aria-label="Graph source coverage">
            <div className="rounded-xl border border-border bg-card px-4 py-3"><p className="text-xs text-muted-foreground">Saved publications</p><p className="mt-1 text-xl font-semibold tabular-nums">{graph.coverage.papers}</p></div>
            <div className="rounded-xl border border-border bg-card px-4 py-3"><p className="text-xs text-muted-foreground">Saved researchers</p><p className="mt-1 text-xl font-semibold tabular-nums">{graph.coverage.researchers}</p></div>
            <div className="rounded-xl border border-border bg-card px-4 py-3"><p className="text-xs text-muted-foreground">Projects</p><p className="mt-1 text-xl font-semibold tabular-nums">{graph.coverage.projects}</p></div>
            <div className="rounded-xl border border-border bg-card px-4 py-3"><p className="text-xs text-muted-foreground">Active Notes</p><p className="mt-1 text-xl font-semibold tabular-nums">{graph.coverage.notes || 0}</p></div>
            <div className="rounded-xl border border-border bg-card px-4 py-3"><p className="text-xs text-muted-foreground">Tasks</p><p className="mt-1 text-xl font-semibold tabular-nums">{graph.coverage.tasks || 0}</p></div>
          </div>

          <section className="eylo-surface mb-4 p-4 sm:p-5" aria-label="Knowledge graph filters">
            <div className="flex flex-col gap-4 lg:flex-row lg:items-end lg:justify-between">
              <label className="min-w-0 flex-1">
                <span className="mb-1 block text-xs font-semibold text-foreground">Find a node</span>
                <span className="relative block"><Search size={15} aria-hidden="true" className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground" /><input value={query} onChange={event => setQuery(event.target.value)} placeholder="Search titles, names, topics or notes" className="min-h-10 w-full rounded-lg border border-border bg-background pl-9 pr-3 text-sm focus:outline-none focus:ring-2 focus:ring-primary/40" /></span>
              </label>
              <fieldset className="flex flex-wrap gap-x-4 gap-y-2">
                <legend className="mb-2 text-xs font-semibold">Node types</legend>
                {NODE_TYPES.map(([type, label]) => <label key={type} className="inline-flex items-center gap-1.5 text-xs text-muted-foreground"><input type="checkbox" checked={types === null || types.includes(type)} onChange={event => changeType(type, event.target.checked)} className="accent-primary" />{label}</label>)}
              </fieldset>
            </div>
          </section>

          <section className="eylo-surface overflow-hidden" aria-labelledby="graph-view-title">
            <div className="flex flex-wrap items-center justify-between gap-3 border-b border-border px-4 py-3 sm:px-5">
              <div><h2 id="graph-view-title" className="text-sm font-semibold">Interactive source map</h2><p className="mt-1 text-xs text-muted-foreground">Select a node to inspect provenance. Drag the canvas to pan; use the controls to zoom.</p></div>
              <div className="flex gap-1">
                <button type="button" aria-label="Zoom out" onClick={() => setZoom(value => Math.max(0.6, Number((value - 0.2).toFixed(2))))} className="grid h-9 w-9 place-items-center rounded-lg border border-border hover:bg-secondary"><Minus size={15} aria-hidden="true" /></button>
                <button type="button" aria-label="Zoom in" onClick={() => setZoom(value => Math.min(2, Number((value + 0.2).toFixed(2))))} className="grid h-9 w-9 place-items-center rounded-lg border border-border hover:bg-secondary"><Plus size={15} aria-hidden="true" /></button>
                <button type="button" aria-label="Reset graph view" onClick={() => { setZoom(1); setPan({ x: 0, y: 0 }); }} className="grid h-9 w-9 place-items-center rounded-lg border border-border hover:bg-secondary"><RotateCcw size={14} aria-hidden="true" /></button>
              </div>
            </div>
            <div className="overflow-auto bg-background/40">
              <svg
                ref={svgRef}
                role="group"
                aria-label={`Research relationship graph with ${drawnNodes.length} visible nodes`}
                viewBox={`0 0 ${GRAPH_BOUNDS.width} ${GRAPH_BOUNDS.height}`}
                className="h-[min(70vh,680px)] min-h-[420px] min-w-[760px] w-full touch-none select-none"
                onPointerDown={handlePointerDown}
                onPointerMove={handlePointerMove}
                onPointerUp={finishPan}
                onPointerCancel={finishPan}
              >
                <g transform={`translate(${pan.x} ${pan.y}) translate(500 350) scale(${zoom}) translate(-500 -350)`}>
                  {drawnEdges.map(edge => <EdgeLine key={edge.id} edge={edge} positions={positions} />)}
                  {drawnNodes.map(node => <NodeGlyph key={node.id} node={node} position={positions.get(node.id)} selected={selected?.id === node.id} onSelect={setSelectedNode} />)}
                </g>
              </svg>
            </div>
            {drawnNodes.length < filtered.nodes.length && <p className="border-t border-border px-4 py-2 text-xs text-muted-foreground">Showing {drawnNodes.length} of {filtered.nodes.length} matching nodes, balanced across record types. Add a filter to explore more.</p>}
            <div className="flex flex-wrap gap-x-4 gap-y-2 border-t border-border px-4 py-3 text-[11px] text-muted-foreground" aria-label="Graph legend">
              {NODE_TYPES.map(([type, label]) => <span key={type} className="inline-flex items-center gap-1.5"><span className="h-2.5 w-2.5 rounded-full" style={{ backgroundColor: TYPE_COLORS[type] }} />{label}</span>)}
              <span className="inline-flex items-center gap-1.5"><span className="w-5 border-t border-slate-400" />Source-backed</span>
              <span className="inline-flex items-center gap-1.5"><span className="w-5 border-t border-dashed border-amber-600" />Inferred topic similarity</span>
            </div>
          </section>

          <div className="mt-4 grid gap-4 xl:grid-cols-[minmax(0,1fr)_minmax(18rem,0.7fr)]">
            <section className="eylo-surface p-4 sm:p-5" aria-labelledby="relationship-list-title">
              <div className="mb-3 flex items-center justify-between gap-3"><h2 id="relationship-list-title" className="text-sm font-semibold">Accessible relationship list</h2><span className="text-xs text-muted-foreground">{filtered.edges.length} links</span></div>
              {filtered.edges.length ? <ul className="max-h-80 space-y-1 overflow-y-auto">{filtered.edges.slice(0, 100).map(edge => {
                const from = graph.nodes.find(node => node.id === edge.from);
                const to = graph.nodes.find(node => node.id === edge.to);
                return <li key={edge.id}><button type="button" onClick={() => setSelectedNode(from || to)} className="flex min-h-10 w-full flex-wrap items-center gap-x-2 gap-y-1 rounded-lg px-2 py-2 text-left text-xs hover:bg-secondary focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary"><span className="font-medium text-foreground">{from?.label || 'Record'}</span><span className={edge.inferred ? 'text-amber-700' : 'text-muted-foreground'}>{edge.label}</span><span className="font-medium text-foreground">{to?.label || 'Record'}</span><span className="sr-only">{edge.provenance}</span></button></li>;
              })}</ul> : <p className="py-8 text-center text-sm text-muted-foreground">No source-backed relationships match these filters. Use the list of nodes below to explore the saved records.</p>}
              {filtered.edges.length > 100 && <p className="mt-2 text-xs text-muted-foreground">Showing 100 relationship rows; use search or node filters to narrow the list.</p>}
            </section>

            <aside className="eylo-surface p-4 sm:p-5" aria-labelledby="selected-node-title" aria-live="polite">
              {selected ? <>
                <p className="text-[10px] font-semibold uppercase tracking-[0.14em] text-primary">{TYPE_LABELS[selected.type] || selected.type}</p>
                <h2 id="selected-node-title" className="mt-2 break-words text-base font-semibold">{selected.label}</h2>
                {selected.details && <p className="mt-2 text-sm leading-6 text-muted-foreground">{selected.details}</p>}
                <p className="mt-3 flex items-start gap-2 text-xs leading-5 text-muted-foreground"><CircleHelp size={14} aria-hidden="true" className="mt-0.5 shrink-0" />{selected.provenance}</p>
                {selected.source_url && <a href={selected.source_url} target="_blank" rel="noopener noreferrer" className="mt-3 inline-flex min-h-9 items-center rounded-lg border border-border px-3 text-xs font-semibold text-primary hover:bg-secondary">Open source record</a>}
                {selected.type === 'project' && <Link to={`/projects/${encodeURIComponent(selected.entity_id)}`} className="mt-3 inline-flex min-h-9 items-center rounded-lg border border-border px-3 text-xs font-semibold text-primary hover:bg-secondary">Open project</Link>}
                {selected.href && <Link to={selected.href} className="mt-3 inline-flex min-h-9 items-center rounded-lg border border-border px-3 text-xs font-semibold text-primary hover:bg-secondary">{selected.type === 'note' ? 'Open note' : 'Open task'}</Link>}
                <h3 className="mt-5 border-t border-border pt-4 text-xs font-semibold">Related records <span className="text-muted-foreground">({related.length})</span></h3>
                {related.length ? <ul className="mt-2 space-y-1">{related.slice(0, 12).map(({ node, edge }) => <li key={`${edge.id}:${node.id}`}><button type="button" onClick={() => setSelectedNode(node)} className="flex min-h-9 w-full items-center justify-between gap-3 rounded-lg px-2 text-left text-xs hover:bg-secondary"><span className="min-w-0"><span className="block truncate font-medium text-foreground">{node.label}</span><span className={edge.inferred ? 'text-amber-700' : 'text-muted-foreground'}>{edge.label}</span></span><span className="shrink-0 text-muted-foreground">Explore</span></button></li>)}</ul> : <p className="mt-2 text-xs text-muted-foreground">No recorded links for this node.</p>}
              </> : <div className="py-6 text-center"><AlertTriangle size={19} className="mx-auto text-muted-foreground" aria-hidden="true" /><h2 id="selected-node-title" className="mt-3 text-sm font-semibold">Select a node</h2><p className="mt-1 text-xs leading-5 text-muted-foreground">Inspect its source, project link and related records here.</p></div>}
            </aside>
          </div>

          <section className="mt-4 rounded-xl border border-border bg-card p-4" aria-labelledby="graph-limits-title">
            <h2 id="graph-limits-title" className="text-xs font-semibold">Coverage and interpretation</h2>
            <p className="mt-1 text-xs leading-5 text-muted-foreground">This is a view of your saved collection, not a comprehensive map of a research field. Citation links appear only when OpenAlex reference IDs connect papers saved in your Library. Dashed amber links are inferred from shared OpenAlex topics and do not indicate citation, agreement, or evidence strength. Unsupported metadata is left unconnected.</p>
          </section>
        </>
      )}

      {loading && <div role="status" className="eylo-surface py-14 text-center text-sm text-muted-foreground">Building your source-backed graph…</div>}
      {!loading && graph.nodes.length > 0 && filtered.nodes.length === 0 && <p role="status" className="eylo-surface mt-4 py-10 text-center text-sm text-muted-foreground">No graph nodes match these filters.</p>}
    </div>
  );
}
