// Companies with documented robotics research, not verified PhD vacancies.
// Sources are official research pages or statements; never invent openings.
export const ROBOTICS_INDUSTRY_LABS = [
  {
    name: 'NVIDIA Seattle Robotics Lab',
    country: 'US',
    topics: 'robotics perception planning control reinforcement learning simulation manipulation',
    url: 'https://research.nvidia.com/labs/srl/',
    evidence: 'Official robotics research laboratory with research publications and roles.',
  },
  {
    name: 'Toyota Research Institute',
    country: 'US',
    topics: 'robotics machine learning robot manipulation humanoid robots autonomous systems',
    url: 'https://pressroom.toyota.com/toyota-research-institute-invests-over-100m-in-collaborative-research-program-with-u-s-universities/',
    evidence: 'Documented university research collaborations covering robotics.',
  },
  {
    name: 'Boston Dynamics',
    country: 'US',
    topics: 'humanoid robots robotic locomotion manipulation embodied artificial intelligence',
    url: 'https://bostondynamics.com/news/boston-dynamics-toyota-research-institute-announce-partnership-to-advance-robotics-research/',
    evidence: 'Documented robotics research partnership with Toyota Research Institute.',
  },
];

export function findIndustryResearchLabs(query, country = '') {
  if (!/(?:\b(?:robotics?|robots?|robotic|humanoid|manipulation)\b|ρομποτικ|ρομπότ)/i.test(String(query || ''))) return [];
  const location = String(country || '').trim().toUpperCase();
  return ROBOTICS_INDUSTRY_LABS
    .filter(lab => !location || lab.country === location)
    .map(lab => ({ ...lab, phdVacancyVerified: false, supervisionVerified: false }));
}
