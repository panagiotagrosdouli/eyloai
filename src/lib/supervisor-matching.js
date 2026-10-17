// Transparent, deterministic candidate ranking. An OpenAlex author record is
// NOT evidence that the researcher is faculty or recruiting PhD students.
export function scoreSupervisorCandidate(researcher, profile = {}) {
  const interests = [profile.research_interests, profile.bio, profile.skills, profile.cv_text]
    .filter(Boolean).join(' ').toLowerCase();
  const tokens = [...new Set((interests.match(/[a-zα-ωάέήίόύώϊϋΐΰ0-9]{4,}/gi) || [])
    .filter(word => !['research', 'science', 'university', 'student', 'studies', 'project', 'experience'].includes(word)))].slice(0, 40);
  const topics = String(researcher.research_areas || '').toLowerCase();
  const overlaps = tokens.filter(word => topics.includes(word)).slice(0, 6);
  const country = String(profile.country || '').trim().toLowerCase();
  const authorCountry = String(researcher.country || '').trim().toLowerCase();
  // Exact ISO-country/code match only; do not infer geography from affiliations.
  const countryMatch = Boolean(country && authorCountry && country === authorCountry);
  return {
    score: overlaps.length * 3 + (countryMatch ? 2 : 0),
    overlaps,
    countryMatch,
    hasProfile: Boolean(tokens.length || country),
  };
}

export function validateCvTextFile(file) {
  if (!file) return 'Choose a CV file.';
  if (!/\.(txt|md)$/i.test(file.name || '')) return 'Upload a plain-text CV (.txt or .md). PDF and DOCX extraction are not enabled yet.';
  if (file.size > 128 * 1024) return 'Your CV is too large. The maximum is 128 KB.';
  return '';
}
