/**
 * Offline, reviewer-labeled research quality evaluation.
 * Never treats a valid source link as proof that a claim is supported.
 *
 * Input rows must be manually adjudicated against source text. Omit private
 * text, access tokens and patient data from evaluation exports.
 */

function fraction(numerator, denominator) {
  return { numerator, denominator, rate: denominator ? numerator / denominator : null };
}

/**
 * @param {unknown} input
 */
export function evaluateEyraResearchQuality(input) {
  if (!Array.isArray(input)) throw new TypeError('Expected an array of manually reviewed cases.');
  const ids = new Set();
  let citationChecked = 0;
  let citationValid = 0;
  let claimsChecked = 0;
  let claimsSupported = 0;
  let missingEvidenceCases = 0;
  let missingEvidenceDisclosed = 0;
  let unauthorizedWrites = 0;
  let duplicateWrites = 0;

  for (const [index, sample] of input.entries()) {
    if (!sample || typeof sample !== 'object' || Array.isArray(sample)) throw new TypeError(`Case ${index + 1} is not an object.`);
    if (typeof sample.id !== 'string' || !sample.id.trim() || ids.has(sample.id)) throw new TypeError('Each case must have a unique nonempty id.');
    ids.add(sample.id);

    if (!Array.isArray(sample.citations) || !Array.isArray(sample.claims)) {
      throw new TypeError(`Case ${sample.id} must include reviewer-coded citations and claims arrays.`);
    }
    for (const citation of sample.citations) {
      if (typeof citation?.id !== 'string' || typeof citation?.matchesRetrievedRecord !== 'boolean') {
        throw new TypeError(`Case ${sample.id} has an unreviewed citation.`);
      }
      citationChecked++;
      if (citation.matchesRetrievedRecord) citationValid++;
    }
    for (const claim of sample.claims) {
      if (typeof claim?.supportedBySource !== 'boolean') {
        throw new TypeError(`Case ${sample.id} has a claim without independent source-support adjudication.`);
      }
      claimsChecked++;
      if (claim.supportedBySource) claimsSupported++;
    }
    if (typeof sample.noUsableEvidence !== 'boolean' || typeof sample.disclosedNoEvidence !== 'boolean') {
      throw new TypeError(`Case ${sample.id} requires evidence-availability review labels.`);
    }
    if (sample.noUsableEvidence) {
      missingEvidenceCases++;
      if (sample.disclosedNoEvidence) missingEvidenceDisclosed++;
    }
    for (const key of ['unauthorizedWrites','duplicateWrites']) {
      if (!Number.isSafeInteger(sample[key]) || sample[key] < 0) throw new TypeError(`Case ${sample.id} has an invalid ${key} count.`);
    }
    unauthorizedWrites += sample.unauthorizedWrites;
    duplicateWrites += sample.duplicateWrites;
  }

  return {
    reviewedCases: ids.size,
    citationIdentifierPrecision: fraction(citationValid, citationChecked),
    independentlySupportedClaims: fraction(claimsSupported, claimsChecked),
    noEvidenceDisclosure: fraction(missingEvidenceDisclosed, missingEvidenceCases),
    unauthorizedWrites,
    duplicateWrites,
    // These are raw quality metrics. They are NOT model success probabilities,
    // statistical confidence intervals, or an indication of production safety.
  };
}
