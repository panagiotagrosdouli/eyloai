function validDoi(value) {
  const doi = String(value || '').trim().replace(/^https?:\/\/(?:dx\.)?doi\.org\//i, '');
  return /^10\.\d{4,9}\/[-._;()/:A-Z0-9]+$/i.test(doi) ? doi : '';
}

/** Return a navigable scholarly URL only for credential-free HTTPS links or valid DOI metadata. */
export function safeResearchSourceUrl(source) {
  if (!source || typeof source !== 'object') return '';
  try {
    const url = new URL(String(source.url || '').trim());
    if (url.protocol === 'https:' && url.hostname && !url.username && !url.password) return url.href;
  } catch { /* use DOI metadata only when its format is valid */ }
  const doi = validDoi(source.doi);
  return doi ? `https://doi.org/${doi}` : '';
}
