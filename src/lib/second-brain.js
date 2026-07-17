// EYRA Second Brain — User Knowledge Profile Builder
// Aggregates all user activity into a personalized intelligence context
// Used by Dashboard, Executive Briefing, For You Feed, etc.

import { base44 } from '@/api/base44Client';

/**
 * Build the full user knowledge profile from all data sources.
 * Returns a structured context object + prompt-ready string.
 */
export async function buildUserProfile() {
  const [user, projects, papers, researchers, opportunities, searches, ideas] = await Promise.all([
    base44.auth.me(),
    base44.entities.Project.list('-updated_date', 20),
    base44.entities.SavedPaper.list('-created_date', 30),
    base44.entities.SavedResearcher.list('-created_date', 20),
    base44.entities.SavedOpportunity.list('-created_date', 20),
    base44.entities.SearchHistory.list('-created_date', 20),
    base44.entities.Idea.list('-created_date', 10).catch(() => []),
  ]);

  // Derive top research topics from searches + paper titles
  const searchTerms = searches.map(s => s.query).filter(Boolean);
  const paperTopics = papers.map(p => p.title).slice(0, 10);
  
  // Active projects context
  const activeProjects = projects.filter(p => p.status === 'active' || p.status === 'planning');
  
  // Compute activity score
  const activityScore = Math.min(
    searches.length * 2 + papers.length * 3 + projects.length * 10 + researchers.length * 2 + opportunities.length * 2,
    100
  );

  const profile = {
    user,
    projects,
    activeProjects,
    papers,
    researchers,
    opportunities,
    searches,
    ideas,
    stats: {
      papers: papers.length,
      researchers: researchers.length,
      opportunities: opportunities.length,
      projects: projects.length,
      searches: searches.length,
      ideas: ideas.length,
      activityScore,
    },
  };

  // Build AI-readable context string
  profile.contextString = buildContextString(profile);
  
  return profile;
}

function buildContextString(profile) {
  const { user, activeProjects, papers, researchers, opportunities, searches, ideas } = profile;
  
  const lines = [
    `USER PROFILE`,
    `Name: ${user?.full_name || 'Researcher'} | Email: ${user?.email || ''}`,
    `Organization: ${user?.organization || 'Not specified'} | Country: ${user?.country || 'Not specified'}`,
    `Research Interests: ${user?.research_interests || 'Not yet specified — learn from activity below'}`,
    `Skills: ${user?.skills || 'Not specified'}`,
    `Career Goal: ${user?.career_goal || 'Not specified'}`,
    `Startup Interest: ${user?.startup_interest || 'Not specified'}`,
    `Bio: ${user?.bio || 'Not specified'}`,
    ``,
    `ACTIVE PROJECTS (${activeProjects.length}):`,
    ...activeProjects.map(p => `- "${p.title}" [${p.status}]: ${p.goal}`),
    activeProjects.length === 0 ? '- No active projects yet' : '',
    ``,
    `RECENT SEARCHES (${searches.length} total, last 10):`,
    ...searches.slice(0, 10).map(s => `- "${s.query}"`),
    searches.length === 0 ? '- No searches yet' : '',
    ``,
    `SAVED PAPERS (${papers.length} total, last 8):`,
    ...papers.slice(0, 8).map(p => `- "${p.title}" by ${p.authors || 'Unknown'} (${p.year || 'n/a'})`),
    papers.length === 0 ? '- No papers saved yet' : '',
    ``,
    `SAVED RESEARCHERS (${researchers.length}):`,
    ...researchers.slice(0, 6).map(r => `- ${r.name} — ${r.institution} — ${r.research_areas}`),
    researchers.length === 0 ? '- No researchers saved yet' : '',
    ``,
    `SAVED OPPORTUNITIES (${opportunities.length}):`,
    ...opportunities.slice(0, 6).map(o => `- ${o.title} (${o.type})`),
    opportunities.length === 0 ? '- No opportunities saved yet' : '',
    ``,
    `IDEAS VAULT (${ideas.length}):`,
    ...ideas.slice(0, 5).map(i => `- [${i.status}] ${i.title}: ${i.description || ''}`),
    ideas.length === 0 ? '- No ideas saved yet' : '',
  ];

  return lines.filter(l => l !== undefined).join('\n');
}

/**
 * Generate today's daily mission based on user profile.
 * Cached in localStorage per day.
 */
export async function getDailyMission(profile) {
  const today = new Date().toDateString();
  const cacheKey = `eyra_mission_${today}`;
  const cached = localStorage.getItem(cacheKey);
  if (cached) {
    try { return JSON.parse(cached); } catch {}
  }

  const isNewUser = profile.stats.activityScore < 10;
  
  const result = await base44.integrations.Core.InvokeLLM({
    prompt: `You are EYRA, a research AI co-founder. Generate today's mission for this user.

${profile.contextString}

Activity level: ${isNewUser ? 'New user — be welcoming and simple' : `${profile.stats.activityScore}/100`}

Generate a focused daily mission with exactly 3 tasks. Tasks must be specific to their actual projects and interests.
If they have no projects, the mission should be to create their first one.
If they have projects but no EYRA analysis, the mission is to run that.
Tasks should take 10-30 minutes each maximum.

Respond as JSON:
- headline: string (1 sentence — what's the theme of today, e.g. "Focus on funding today")  
- tasks: array of exactly 3 objects, each with: task (string, specific action), type ("read"|"discover"|"connect"|"write"|"review"), estimated_minutes (number 10-30)
- motivation: string (1 sentence of encouragement)`,
    response_json_schema: {
      type: 'object',
      properties: {
        headline: { type: 'string' },
        tasks: {
          type: 'array',
          items: {
            type: 'object',
            properties: {
              task: { type: 'string' },
              type: { type: 'string' },
              estimated_minutes: { type: 'number' },
            },
          },
        },
        motivation: { type: 'string' },
      },
    },
  });

  localStorage.setItem(cacheKey, JSON.stringify(result));
  return result;
}

/**
 * Generate personalized For You feed items.
 */
export async function getPersonalizedFeed(profile) {
  const result = await base44.integrations.Core.InvokeLLM({
    prompt: `You are EYRA. Based on this user's research profile, generate a personalized intelligence feed.

${profile.contextString}

Generate 8 feed items that are highly relevant to this specific user. Mix types: papers (suggest real search terms), researchers (suggest real search terms), grants (real programs), trends, and action recommendations.

RULES:
- Every item must directly relate to their actual projects, interests, or recent searches
- For papers/researchers: suggest what to SEARCH FOR, not invent specific people
- For grants: only name REAL funding programs (Horizon Europe, ERC, NSF, NIH, etc.)
- State why each item is relevant to THIS user
- Confidence: HIGH if based on explicit profile data, MEDIUM if inferred from activity

Respond as JSON with array "feed" where each item has:
- type: "paper_search"|"researcher_search"|"grant"|"trend"|"action"
- title: string
- description: string  
- why_relevant: string (specific to this user's data)
- confidence: "HIGH"|"MEDIUM"
- action_label: string (e.g. "Search now", "Apply", "Explore")
- action_query: string (search query or URL for action)`,
    response_json_schema: {
      type: 'object',
      properties: {
        feed: {
          type: 'array',
          items: {
            type: 'object',
            properties: {
              type: { type: 'string' },
              title: { type: 'string' },
              description: { type: 'string' },
              why_relevant: { type: 'string' },
              confidence: { type: 'string' },
              action_label: { type: 'string' },
              action_query: { type: 'string' },
            },
          },
        },
      },
    },
  });

  return result.feed || [];
}
