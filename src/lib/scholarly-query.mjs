// Provider-native Boolean syntax. The original user query remains the ranking
// criterion; retrieval alternatives do not change relevance/acceptance gates.
const STOP = new Set([
  "and",
  "for",
  "from",
  "into",
  "the",
  "this",
  "that",
  "using",
  "with",
  "aware",
  "of",
  "in",
  "on",
  "a",
  "an",
]);
const ALTERNATIVES = Object.freeze({
  ai: [
    "AI",
    '"artificial intelligence"',
    '"machine learning"',
    '"deep learning"',
  ],
  robotics: ["robot*"],
  ageing: ["ageing", "aging", '"older adults"', "elderly"],
  aging: ["aging", "ageing", '"older adults"', "elderly"],
  independent: ["independen*"],
  uncertainty: ["uncertain*", "probabilis*", "stochastic", "confidence"],
  trajectory: ["trajector*", '"motion prediction"', '"path prediction"'],
  prediction: ["predict*"],
  detection: ["detect*", "screen*", "diagnos*"],
  vulnerable: ["vulnerab*", "pedestrian*", "cyclist*"],
  road: ["road", "traffic"],
  users: ["users", "pedestrian*", "cyclist*"],
  trustworthy: ["trustworth*", "responsib*", "ethic*", "fair*", "explainab*"],
});
export function scholarlyQueryTerms(query) {
  return [
    ...new Set(
      String(query)
        .toLowerCase()
        .match(/[\p{L}\p{N}]+/gu) || [],
    ),
  ].filter((term) => !STOP.has(term));
}
export function buildScholarlyQuery(provider, query) {
  const terms = scholarlyQueryTerms(query);
  if (!terms.length) return query;
  if (provider === "crossref") return terms.join(" ");
  if (!["arxiv", "europe_pmc"].includes(provider)) return query;
  return terms
    .map((term) => {
      const alternatives =
        Object.hasOwn(ALTERNATIVES, term) &&
        (term !== "users" ||
          (terms.includes("vulnerable") && terms.includes("road")))
          ? ALTERNATIVES[term]
          : [`"${term}"`];
      return (
        "(" +
        alternatives
          .map((value) => (provider === "arxiv" ? "all:" + value : value))
          .join(" OR ") +
        ")"
      );
    })
    .join(" AND ");
}
