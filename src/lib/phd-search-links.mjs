// Public browser-only handoffs. EYLO never claims these links are verified
// in-app vacancies or quietly synthesizes PhD titles, deadlines or eligibility.
const FIND_A_PHD_URL = 'https://www.findaphd.com/phds/';
const EURAXESS_URL = 'https://euraxess.ec.europa.eu/jobs/search';

export function phdSearchKeywords(input) {
  const query = String(input || '').slice(0, 180).replace(/\s+/g, ' ').trim();
  return query
    .replace(/\b(?:ph\.?d\.?|doctoral|doctorate)\b/gi, ' ')
    .replace(/\s+/g, ' ')
    .replace(/^(?:in|for|on|about)\s+/i, '')
    .trim();
}

export function phdSourceLinks(query) {
  const keywords = phdSearchKeywords(query);
  return {
    keywords,
    findaphd: keywords ? FIND_A_PHD_URL + '?Keywords=' + encodeURIComponent(keywords) : FIND_A_PHD_URL,
    euraxess: EURAXESS_URL,
  };
}
