/**
 * EYRA Persona System
 * Defines per-user-type: EYRA role, focus areas, examples, mission style, greeting suffix
 */

export const PERSONAS = {
  student: {
    label: 'Student',
    eyraRole: 'Research Mentor',
    tagline: 'Your AI Research Mentor',
    greeting: 'What are we learning today?',
    examples: [
      'Help me pick a thesis topic in AI',
      'Explain federated learning for beginners',
      'Find papers on climate change and machine learning',
      'How do I write a literature review?',
      'Recommended datasets for my project',
    ],
    focusAreas: ['Thesis Topics', 'Learning Paths', 'Literature Reviews', 'Recommended Papers'],
    missionContext: 'undergraduate or early graduate student who needs guidance on research fundamentals, thesis selection, and academic writing',
    missionTypes: ['read', 'write', 'discover'],
    briefingContext: 'student focused on learning, thesis development, and foundational research skills',
    quickLinks: [
      { label: 'Start a Literature Review', href: '/', query: 'literature review methodology guide' },
      { label: 'Find Thesis Topics', href: '/foryou' },
      { label: 'Knowledge Library', href: '/library' },
      { label: 'Discover Researchers', href: '/researchers' },
    ],
  },
  masters: {
    label: "Master's Student",
    eyraRole: 'Academic Supervisor',
    tagline: 'Your AI Academic Supervisor',
    greeting: 'What shall we research today?',
    examples: [
      'Find research gaps in NLP for healthcare',
      'Suggest journals for my paper submission',
      'Find collaborators in computational biology',
      'Help me design my research methodology',
      'Map the literature on transformer models',
    ],
    focusAreas: ['Research Gaps', 'Methodology', 'Literature Mapping', 'Publication Strategy'],
    missionContext: "Master's student building research expertise, designing methodology, and preparing for publication or PhD applications",
    missionTypes: ['read', 'write', 'discover', 'connect'],
    briefingContext: "Master's student focused on methodology, literature gaps, and research design",
    quickLinks: [
      { label: 'Find Research Gaps', href: '/', query: 'research gaps in my field' },
      { label: 'EYRA Feed', href: '/foryou' },
      { label: 'Library', href: '/library' },
      { label: 'Future Simulator', href: '/future' },
    ],
  },
  phd: {
    label: 'PhD Researcher',
    eyraRole: 'Research Strategist',
    tagline: 'Your AI Research Strategist',
    greeting: 'What problem are we solving today?',
    examples: [
      'Novelty analysis for AI in drug discovery',
      'Find conferences for my research area',
      'Identify research gaps in quantum ML',
      'Best grants for early-career researchers',
      'Map my competitors in this research space',
    ],
    focusAreas: ['Novelty Detection', 'Research Gaps', 'Conferences', 'Funding', 'Collaborations'],
    missionContext: 'PhD researcher focused on original contributions, high-impact publications, conference presence, and early-career funding',
    missionTypes: ['discover', 'write', 'connect', 'review'],
    briefingContext: 'PhD researcher tracking novelty, research gaps, publication opportunities, and academic funding',
    quickLinks: [
      { label: 'Research Battlefield', href: '/battlefield' },
      { label: 'Opportunity Radar', href: '/radar' },
      { label: 'EYRA Feed', href: '/foryou' },
      { label: 'Executive Briefing', href: '/briefing' },
    ],
  },
  professor: {
    label: 'Professor',
    eyraRole: 'Research Director',
    tagline: 'Your AI Research Director',
    greeting: 'What are we directing today?',
    examples: [
      'Find Horizon Europe grants for AI research',
      'Build a research consortium in genomics',
      'Discover PhD candidates in my field',
      'Map innovation opportunities for my lab',
      'Find strategic research partnerships',
    ],
    focusAreas: ['Research Teams', 'Funding & Grants', 'Consortium Building', 'Student Discovery'],
    missionContext: 'Professor or research lead managing teams, pursuing large grants, building consortia, and strategic direction of a lab or department',
    missionTypes: ['review', 'connect', 'discover'],
    briefingContext: 'professor focused on research team management, large-scale funding, and strategic research direction',
    quickLinks: [
      { label: 'Opportunity Radar', href: '/radar' },
      { label: 'Dream Team Builder', href: '/dreamteam' },
      { label: 'Executive Briefing', href: '/briefing' },
      { label: 'Researchers', href: '/researchers' },
    ],
  },
  founder: {
    label: 'Startup Founder',
    eyraRole: 'AI Co-Founder',
    tagline: 'Your AI Co-Founder',
    greeting: 'What are we building today?',
    examples: [
      'Analyze competitors in the healthtech space',
      'Find investors for my AI startup',
      'Build my startup team from research',
      'Find accelerators for deep tech startups',
      'Market size analysis for my product',
    ],
    focusAreas: ['Market Analysis', 'Investor Matching', 'Team Building', 'Startup Strategy', 'Funding'],
    missionContext: 'startup founder building a research-driven or deep tech company, focused on investors, team, market, and growth',
    missionTypes: ['discover', 'connect', 'review'],
    briefingContext: 'startup founder focused on market trends, investor opportunities, team gaps, and competitive intelligence',
    quickLinks: [
      { label: 'Opportunity Radar', href: '/radar' },
      { label: 'Dream Team Builder', href: '/dreamteam' },
      { label: 'Future Simulator', href: '/future' },
      { label: 'Impact Predictor', href: '/impact' },
    ],
  },
  organization: {
    label: 'Organization',
    eyraRole: 'Innovation Advisor',
    tagline: 'Your AI Innovation Advisor',
    greeting: 'What shall we innovate today?',
    examples: [
      'Find research partnerships in AI and health',
      'Discover innovation opportunities for our sector',
      'Map talent and researchers in robotics',
      'Find calls for proposals in green tech',
      'Benchmark competitors in innovation',
    ],
    focusAreas: ['Innovation Programs', 'Research Partnerships', 'Talent Discovery', 'Strategic Opportunities'],
    missionContext: 'organization or corporate innovation team looking for research partnerships, talent, and innovation programs',
    missionTypes: ['discover', 'connect', 'review'],
    briefingContext: 'organization seeking innovation partnerships, research talent, and strategic opportunities',
    quickLinks: [
      { label: 'Opportunity Radar', href: '/radar' },
      { label: 'Researchers', href: '/researchers' },
      { label: 'Executive Briefing', href: '/briefing' },
      { label: 'Research Battlefield', href: '/battlefield' },
    ],
  },
};

export const DEFAULT_PERSONA = PERSONAS.phd;

export function getPersona(userType) {
  return PERSONAS[userType] || DEFAULT_PERSONA;
}

export const USER_TYPE_OPTIONS = [
  { value: 'student',      label: 'Student',           desc: 'Undergraduate or early graduate student', emoji: '📚' },
  { value: 'masters',      label: "Master's Student",  desc: 'Research-focused graduate student',        emoji: '🎓' },
  { value: 'phd',          label: 'PhD Researcher',    desc: 'Doctoral researcher or postdoc',           emoji: '🔬' },
  { value: 'professor',    label: 'Professor',         desc: 'Faculty, lab lead, or research director',  emoji: '🏛️' },
  { value: 'founder',      label: 'Startup Founder',   desc: 'Building a research-driven startup',       emoji: '🚀' },
  { value: 'organization', label: 'Organization',      desc: 'Corporate or institutional innovator',     emoji: '🏢' },
];
