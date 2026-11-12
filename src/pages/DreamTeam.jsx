import React, { useState, useEffect, useMemo, useRef } from 'react';
import { base44 } from '@/api/base44Client';
import { searchOpenAlexAuthors, searchOpenAlexInstitutions } from '@/lib/eyra-api';
import { saveResearcherCandidate as persistResearcherCandidate } from '@/lib/researcher-shortlist.mjs';
import { calculateDraftCompleteness, rankResearchersForRoles } from '@/lib/team-planner-evidence.mjs';
import { motion } from 'framer-motion';
import { useToast } from '@/components/ui/use-toast';
import {
  Sparkles, Loader2, Users, Brain, Code, Briefcase,
  Star, ChevronRight, Target, Lightbulb,
  Building2, UserPlus, RefreshCw, FolderOpen, ExternalLink
} from 'lucide-react';

const EXAMPLES = [
  'AI drug discovery startup targeting rare diseases',
  'Federated learning platform for hospital networks',
  'Climate tech startup using satellite data',
];

const ROLE_ICONS = {
  'AI/ML': Brain,
  'Research': Star,
  'Engineering': Code,
  'Business': Briefcase,
  'Clinical': Building2,
  default: UserPlus,
};

export default function DreamTeam() {
  const [query, setQuery] = useState('');
  const [team, setTeam] = useState(null);
  const [loading, setLoading] = useState(false);
  const [projects, setProjects] = useState([]);
  const [selectedProjectId, setSelectedProjectId] = useState('');
  const [buildError, setBuildError] = useState('');
  const [savingResearcherId, setSavingResearcherId] = useState('');
  const [savedResearcherProjects, setSavedResearcherProjects] = useState({});
  const buildSequence = useRef(0);
  const buildController = useRef(null);
  const { toast } = useToast();
  const rankedCandidates = useMemo(
    () => rankResearchersForRoles(team?.candidate_researchers || [], team?.dream_team || []),
    [team],
  );

  useEffect(() => () => {
    buildSequence.current += 1;
    buildController.current?.abort();
  }, []);

  useEffect(() => {
    base44.entities.Project.list('-updated_date', 10).then(projs => {
      setProjects(projs);
      // Auto-select the first active project
      const active = projs.find(p => p.status === 'active') || projs[0];
      if (active) {
        setSelectedProjectId(active.id);
        setQuery(`${active.title}: ${active.goal}`);
      }
    });
  }, []);

  const handleProjectSelect = (e) => {
    const pid = e.target.value;
    buildController.current?.abort();
    buildSequence.current += 1;
    setLoading(false);
    setTeam(null);
    setBuildError('');
    setSelectedProjectId(pid);
    if (pid) {
      const proj = projects.find(p => p.id === pid);
      if (proj) setQuery(`${proj.title}: ${proj.goal}`);
    } else {
      setQuery('');
    }
  };

  const build = async (q) => {
    const searchQuery = q || query;
    if (!searchQuery.trim()) return;
    buildController.current?.abort();
    const requestId = ++buildSequence.current;
    const controller = new AbortController();
    buildController.current = controller;
    setQuery(searchQuery);
    setLoading(true);
    setTeam(null);
    setBuildError('');

    try {
      const [researchers, institutions] = await Promise.all([
        searchOpenAlexAuthors(searchQuery, 8, { signal: controller.signal, throwOnError: true }),
        searchOpenAlexInstitutions(searchQuery, 5, { signal: controller.signal, throwOnError: true }),
      ]);
      if (requestId !== buildSequence.current) return;

      const researcherContext = researchers.map((researcher, index) =>
        `[R${index + 1}] ${researcher.name} — ${researcher.institution} — ${researcher.works_count} works, ${researcher.citation_count} citations — ${researcher.profile_url}`
      ).join('\n');
      const institutionContext = institutions.map((institution, index) =>
        `[I${index + 1}] ${institution.name} (${institution.country}) — ${institution.works_count} works — ${institution.url}`
      ).join('\n');

      const result = await base44.integrations.Core.InvokeLLM({
        prompt: `You are EYRA Team Design Analyst.

PROJECT: "${searchQuery}"

RETRIEVED RESEARCHER RECORDS FROM OPENALEX:
${researcherContext || 'No matching researchers were retrieved.'}

RETRIEVED INSTITUTION RECORDS FROM OPENALEX:
${institutionContext || 'No matching institutions were retrieved.'}

Design the roles and partner capabilities needed for this project.

Rules:
- Do not invent named people or institutions.
- Named candidates shown in the interface come only from [R] and [I] records.
- Distinguish role suggestions from retrieved, source-indexed candidate records.
- Do not estimate salary, compensation, equity, employment status, academic rank, researcher availability or willingness to collaborate.
- Role suggestions and outreach wording are AI-generated planning drafts requiring human review.

Return project_summary, current_gaps, dream_team, hiring_sequence, consortium_partners, eyra_team_insight, and first_hire_advice.`,
        response_json_schema: {
          type: 'object',
          properties: {
            project_summary: { type: 'string' },
            current_gaps: { type: 'array', items: { type: 'string' } },
            dream_team: {
              type: 'array',
              items: {
                type: 'object',
                properties: {
                  role: { type: 'string' },
                  category: { type: 'string', enum: ['AI/ML', 'Research', 'Engineering', 'Business', 'Clinical', 'Other'] },
                  priority: { type: 'string', enum: ['Critical', 'High', 'Medium'] },
                  why_needed: { type: 'string' },
                  key_skills: { type: 'array', items: { type: 'string' } },
                  ideal_background: { type: 'string' },
                  where_to_find: { type: 'string' },
                  outreach_hook: { type: 'string' },
                  seniority: { type: 'string' },
                },
              },
            },
            hiring_sequence: { type: 'array', items: { type: 'string' } },
            consortium_partners: {
              type: 'array',
              items: {
                type: 'object',
                properties: {
                  type: { type: 'string' },
                  role: { type: 'string' },
                  ideal: { type: 'string' },
                },
              },
            },
            eyra_team_insight: { type: 'string' },
            first_hire_advice: { type: 'string' },
          },
        },
        signal: controller.signal,
      });
      if (requestId !== buildSequence.current) return;

      setTeam({
        ...result,
        draft_completeness: calculateDraftCompleteness(result),
        candidate_researchers: researchers,
        candidate_institutions: institutions,
      });
    } catch (error) {
      if (requestId === buildSequence.current && !controller.signal.aborted) {
        setBuildError(error instanceof Error ? error.message : 'Team analysis did not complete.');
      }
    } finally {
      if (requestId === buildSequence.current) {
        buildController.current = null;
        setLoading(false);
      }
    }
  };

  const saveResearcher = async (researcher) => {
    const openalexId = researcher.openalex_id || researcher.id;
    if (!openalexId || savingResearcherId) return;
    setSavingResearcherId(openalexId);
    try {
      const project = selectedProjectId
        ? projects.find(item => item.id === selectedProjectId)
        : null;
      if (selectedProjectId && !project) {
        throw new Error('The selected project is unavailable. Refresh your projects and try again.');
      }
      const result = await persistResearcherCandidate({
        entities: base44.entities,
        researcher,
        project,
      });
      setSavedResearcherProjects(current => ({ ...current, [openalexId]: result.projectId || '' }));
      const messages = {
        saved: {
          title: project ? `Added to ${project.title || 'project'}` : 'Researcher saved to Library',
          description: 'This saves the public profile record; it does not contact the researcher.',
        },
        linked: { title: `Added to ${project?.title || 'project'}`, description: 'Researcher saved in your Library.' },
        already_saved: { title: 'Researcher already in your Library' },
        already_in_project: { title: 'Already in this project' },
        already_linked: {
          title: 'Already linked to another project',
          description: 'The researcher remains in the Library and was not moved from the existing project.',
        },
      };
      toast(messages[result.status]);
    } catch (error) {
      toast({
        title: 'Could not save researcher',
        description: error instanceof Error ? error.message : 'Please try again.',
        variant: 'destructive',
      });
    } finally {
      setSavingResearcherId('');
    }
  };

  const priorityColor = {
    Critical: 'text-red-400 bg-red-500/10 border-red-500/20',
    High: 'text-amber-400 bg-amber-500/10 border-amber-500/20',
    Medium: 'text-green-400 bg-green-500/10 border-green-500/20',
  };

  return (
    <div className="eylo-page">
      <div className="mb-6">
        <h1 className="eylo-page-heading">Team Planner</h1>
      </div>

      <div className="mb-4 rounded-xl border border-border bg-secondary/20 p-3 text-[11px] text-muted-foreground">
        Role design is AI analysis. Named researcher and institution profiles are retrieved records, not generated people.
      </div>
      {buildError && (
        <div role="alert" className="mb-4 rounded-xl border border-red-500/20 bg-red-500/5 p-3 text-xs text-red-300">
          {buildError}
        </div>
      )}

      {/* Project selector — connect to existing projects */}
      {projects.length > 0 && (
        <div className="mb-4 p-4 rounded-xl border border-border bg-card">
          <div className="flex items-center gap-2 mb-2">
            <FolderOpen size={13} className="text-primary" />
            <p className="text-xs font-semibold text-foreground">Use an existing project</p>
          </div>
          <select
            value={selectedProjectId}
            onChange={handleProjectSelect}
            className="w-full h-10 px-3 rounded-lg border border-border bg-secondary text-sm text-foreground focus:outline-none focus:ring-1 focus:ring-primary/40"
          >
            <option value="">Select a project…</option>
            {projects.map(p => (
              <option key={p.id} value={p.id}>{p.title} ({p.status || 'planning'})</option>
            ))}
          </select>
        </div>
      )}

      {/* Manual input */}
      <div className="mb-6">
        <form onSubmit={e => { e.preventDefault(); build(); }} className="flex gap-2">
          <div className="flex-1 relative">
            <Target size={15} className="absolute left-4 top-1/2 -translate-y-1/2 text-primary" />
            <input
              type="text"
              value={query}
              onChange={e => {
                buildController.current?.abort();
                buildSequence.current += 1;
                setLoading(false);
                setTeam(null);
                setBuildError('');
                setQuery(e.target.value);
                setSelectedProjectId('');
              }}
              placeholder="Or describe your project / startup..."
              className="w-full h-12 pl-11 pr-4 rounded-xl border border-border bg-secondary text-sm text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-1 focus:ring-primary/40"
            />
          </div>
          <button
            type="submit"
            disabled={!query.trim() || loading}
            className="flex items-center gap-2 px-6 py-3 rounded-xl bg-primary text-primary-foreground text-sm font-semibold disabled:opacity-40"
          >
            {loading ? <Loader2 size={14} className="animate-spin" /> : <Sparkles size={14} />}
            Build Team
          </button>
        </form>
        {!team && !loading && !selectedProjectId && (
          <div className="flex flex-wrap gap-2 mt-3">
            {EXAMPLES.map(ex => (
              <button key={ex} onClick={() => build(ex)}
                className="px-3 py-1.5 rounded-full border border-border/60 bg-secondary/40 text-xs text-muted-foreground hover:text-foreground hover:border-primary/40 transition-all">
                {ex}
              </button>
            ))}
          </div>
        )}
      </div>

      {loading && (
        <div className="flex flex-col items-center justify-center py-20">
          <div className="w-16 h-16 rounded-2xl eyra-gradient flex items-center justify-center mb-5 ">
            <Users size={26} className="text-white" />
          </div>
          <p className="text-sm font-semibold mb-1">Building your dream team...</p>
          <p className="text-xs text-muted-foreground">Retrieving real profiles, then designing roles and partner needs</p>
          <div className="flex gap-1.5 mt-4">
            {[0,1,2,3,4].map(i => (
              <div key={i} className="w-1.5 h-1.5 rounded-full bg-primary animate-bounce" style={{ animationDelay: `${i * 0.1}s` }} />
            ))}
          </div>
        </div>
      )}

      {team && !loading && (
        <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} className="space-y-5">
          {/* Summary row */}
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
            <div className="sm:col-span-2 p-4 rounded-xl border border-border/60 bg-secondary/20">
              <p className="text-sm text-foreground/80">{team.project_summary}</p>
            </div>
            <div className="p-4 rounded-xl border border-border bg-card text-center">
              <p className="text-[10px] uppercase tracking-wider text-muted-foreground mb-1">Draft completeness</p>
              <p className="text-4xl font-black text-primary">{team.draft_completeness}</p>
              <p className="text-[10px] text-muted-foreground">of draft fields filled · not a quality score</p>
            </div>
          </div>

          {(team.candidate_researchers?.length > 0 || team.candidate_institutions?.length > 0) && (
            <div className="rounded-2xl border border-green-500/20 bg-green-500/5 p-5">
              <p className="mb-1 text-[10px] font-semibold uppercase tracking-widest text-green-400">Retrieved OpenAlex profiles</p>
              <p className="mb-4 text-xs text-muted-foreground">Role relevance compares proposed role terms with publication-derived OpenAlex topic labels. It does not verify expertise, affiliation, availability or willingness to collaborate.</p>
              <div className="grid gap-3 sm:grid-cols-2">
                {rankedCandidates.slice(0, 6).map(({ researcher, roleMatches, matchedTerms }) => {
                  const researcherId = researcher.openalex_id || researcher.id;
                  const hasSavedResearcher = Object.prototype.hasOwnProperty.call(savedResearcherProjects, researcherId);
                  const savedProjectId = savedResearcherProjects[researcherId];
                  const alreadySavedHere = hasSavedResearcher
                    && (!selectedProjectId || savedProjectId === selectedProjectId || Boolean(savedProjectId));
                  return <article key={researcherId}
                    className="rounded-xl border border-border bg-card p-3 hover:border-primary/30">
                    <div className="flex items-start justify-between gap-2">
                      <div>
                        <p className="text-xs font-semibold text-foreground">{researcher.name}</p>
                        <p className="mt-0.5 text-[10px] text-muted-foreground">{researcher.institution}</p>
                        <p className="mt-1 text-[10px] text-muted-foreground">{researcher.works_count} works · {researcher.citation_count} citations</p>
                        <p className="mt-1 text-[10px] leading-4 text-primary">{matchedTerms.length
                          ? `Indexed topic overlap: ${matchedTerms.join(', ')}${roleMatches.length ? ` · ${roleMatches.map(match => match.role).join(', ')}` : ''}`
                          : 'No direct overlap in available indexed topics; inspect the profile manually.'}</p>
                        {researcher.research_areas && <p className="mt-1 text-[10px] text-muted-foreground">OpenAlex topics: {researcher.research_areas}</p>}
                      </div>
                      <a href={researcher.profile_url} target="_blank" rel="noopener noreferrer"
                        aria-label={`Open OpenAlex author record for ${researcher.name}`}
                        className="inline-flex min-h-8 items-center gap-1 rounded-md px-2 text-[10px] font-semibold text-primary hover:bg-secondary">
                        Open profile <ExternalLink size={11} aria-hidden="true" />
                      </a>
                    </div>
                    <button type="button"
                      onClick={() => saveResearcher(researcher)}
                      disabled={Boolean(savingResearcherId) || alreadySavedHere}
                      className="mt-3 min-h-9 rounded-lg border border-border px-3 text-xs font-semibold text-foreground hover:border-primary/40 disabled:cursor-default disabled:opacity-60">
                      {savingResearcherId === researcherId
                        ? 'Saving…'
                        : alreadySavedHere
                          ? selectedProjectId ? savedProjectId === selectedProjectId ? 'Added to project' : 'Linked to another project' : 'Saved to Library'
                          : selectedProjectId ? 'Add to project' : 'Save to Library'}
                    </button>
                  </article>;
                })}
              </div>
            </div>
          )}

          {/* Gaps */}
          {team.current_gaps?.length > 0 && (
            <div className="p-4 rounded-xl border border-amber-500/20 bg-amber-500/5">
              <p className="text-[10px] font-semibold uppercase tracking-wider text-amber-400 mb-2">Critical Gaps Detected</p>
              <div className="space-y-1">
                {team.current_gaps.map((g, i) => (
                  <p key={i} className="text-xs text-foreground/80 flex items-start gap-1.5">
                    <ChevronRight size={11} className="text-amber-400 mt-0.5 flex-shrink-0" /> {g}
                  </p>
                ))}
              </div>
            </div>
          )}

          {/* Dream Team */}
          <div>
            <p className="text-[10px] font-semibold uppercase tracking-widest text-muted-foreground mb-3">Your Dream Team</p>
            <div className="space-y-4">
              {team.dream_team?.map((member, i) => {
                const CategoryIcon = ROLE_ICONS[member.category] || ROLE_ICONS.default;
                return (
                  <motion.div key={i} initial={{ opacity: 0, x: -8 }} animate={{ opacity: 1, x: 0 }}
                    transition={{ delay: i * 0.05 }} className="p-5 rounded-xl border border-border bg-card">
                    <div className="flex items-start gap-4">
                      <div className="w-10 h-10 rounded-xl bg-secondary border border-border flex items-center justify-center flex-shrink-0">
                        <CategoryIcon size={16} className="text-primary" />
                      </div>
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center justify-between gap-3 mb-1 flex-wrap">
                          <h4 className="font-semibold text-sm text-foreground">{member.role}</h4>
                          <div className="flex items-center gap-2 flex-shrink-0">
                            <span className={`text-[10px] px-2 py-0.5 rounded-full border font-semibold ${priorityColor[member.priority] || 'border-border text-muted-foreground'}`}>
                              {member.priority}
                            </span>
                          <span className="text-[10px] text-muted-foreground">Suggested seniority: {member.seniority}</span>
                          </div>
                        </div>
                        <p className="text-xs text-muted-foreground mb-3">{member.why_needed}</p>
                        <div className="grid sm:grid-cols-3 gap-3 text-xs">
                          <div>
                            <p className="text-[10px] font-semibold text-muted-foreground uppercase mb-1">Background</p>
                            <p className="text-foreground/80 leading-relaxed">{member.ideal_background}</p>
                          </div>
                          <div>
                            <p className="text-[10px] font-semibold text-muted-foreground uppercase mb-1">Where to Find</p>
                            <p className="text-foreground/80 leading-relaxed">{member.where_to_find}</p>
                          </div>
                          <div>
                            <p className="text-[10px] font-semibold text-muted-foreground uppercase mb-1">Outreach Hook</p>
                            <p className="text-foreground/80 leading-relaxed">{member.outreach_hook}</p>
                          </div>
                        </div>
                        <div className="flex items-center gap-3 mt-3 pt-3 border-t border-border/40">
                          <div className="flex flex-wrap gap-1.5">
                            {member.key_skills?.map(s => (
                              <span key={s} className="text-[10px] px-2 py-0.5 rounded-full border border-border/60 bg-secondary/50 text-muted-foreground">{s}</span>
                            ))}
                          </div>
                        </div>
                      </div>
                    </div>
                  </motion.div>
                );
              })}
            </div>
          </div>

          {/* Hiring sequence */}
          {team.hiring_sequence?.length > 0 && (
            <div className="p-5 rounded-xl border border-border bg-card">
              <p className="text-[10px] font-semibold uppercase tracking-wider text-muted-foreground mb-3">Hiring Sequence</p>
              <div className="space-y-2">
                {team.hiring_sequence.map((h, i) => (
                  <div key={i} className="flex items-center gap-3">
                    <div className="w-6 h-6 rounded-full eyra-gradient flex items-center justify-center text-white text-[10px] font-bold flex-shrink-0">{i + 1}</div>
                    <p className="text-xs text-foreground/80">{h}</p>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Consortium Partners */}
          {team.consortium_partners?.length > 0 && (
            <div>
              <p className="text-[10px] font-semibold uppercase tracking-widest text-muted-foreground mb-3">Consortium Partners to Recruit</p>
              <div className="grid sm:grid-cols-3 gap-3">
                {team.consortium_partners.map((p, i) => (
                  <div key={i} className="p-4 rounded-xl border border-border bg-card">
                    <p className="text-xs font-bold text-primary mb-1">{p.type}</p>
                    <p className="text-xs text-foreground/80 mb-2">{p.role}</p>
                    <p className="text-[10px] text-muted-foreground italic">{p.ideal}</p>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* EYRA insight */}
          <div className="grid sm:grid-cols-2 gap-4">
            {team.eyra_team_insight && (
              <div className="p-5 rounded-2xl border border-primary/20 bg-primary/5">
                <div className="flex items-center gap-2 mb-2">
                  <Sparkles size={12} className="text-primary" />
                  <span className="text-[10px] font-bold text-primary uppercase tracking-widest">EYRA Team Insight</span>
                </div>
                <p className="text-xs text-foreground/80 leading-relaxed">{team.eyra_team_insight}</p>
              </div>
            )}
            {team.first_hire_advice && (
              <div className="p-5 rounded-2xl border border-amber-500/20 bg-amber-500/5">
                <div className="flex items-center gap-2 mb-2">
                  <Lightbulb size={12} className="text-amber-400" />
                  <span className="text-[10px] font-bold text-amber-400 uppercase tracking-widest">First Hire Advice</span>
                </div>
                <p className="text-xs text-foreground/80 leading-relaxed">{team.first_hire_advice}</p>
              </div>
            )}
          </div>

          <button onClick={() => build()} className="flex items-center gap-1.5 text-xs text-muted-foreground hover:text-primary transition-colors">
            <RefreshCw size={11} /> Rebuild with different parameters
          </button>
        </motion.div>
      )}
    </div>
  );
}
