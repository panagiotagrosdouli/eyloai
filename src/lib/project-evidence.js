function clean(value) {
  return String(value || '').trim();
}

export function canonicalDoi(value) {
  let doi = clean(value)
    .toLowerCase()
    .replace(/^https?:\/\/(?:dx\.)?doi\.org\//, '')
    .replace(/^doi:\s*/, '');
  try {
    doi = decodeURIComponent(doi);
  } catch {
    // Preserve provider text when encoding is malformed.
  }
  return /^10\.\d{4,9}\/\S+$/i.test(doi) ? doi : '';
}

export function mergeProjectIds(entity, projectId) {
  const id = clean(projectId);
  const existing = Array.isArray(entity?.project_ids)
    ? entity.project_ids.map(clean).filter(Boolean)
    : [];
  if (entity?.project_id) existing.push(clean(entity.project_id));
  if (id) existing.push(id);
  return [...new Set(existing)];
}

export function paperLookupFilter(paper) {
  const doi = canonicalDoi(paper?.doi || '');
  if (doi) return { doi };
  const url = clean(paper?.url);
  return url ? { url } : null;
}

export function researcherLookupFilter(researcher) {
  const profileUrl = clean(researcher?.profile_url);
  if (profileUrl) return { profile_url: profileUrl };
  const name = clean(researcher?.name);
  const institution = clean(researcher?.institution);
  return name && institution ? { name, institution } : null;
}

export function projectAssociationFilter(projectId) {
  const id = clean(projectId);
  return id ? { project_ids: [id] } : null;
}

export function buildProjectEvidenceContext(papers = [], researchers = [], opportunities = []) {
  const paperLines = papers.slice(0, 12).map((paper, index) => {
    const doi = canonicalDoi(paper?.doi || '');
    const identity = doi ? ` DOI: ${doi}.` : paper?.url ? ` URL: ${paper.url}` : '';
    return `[S${index + 1}] "${clean(paper?.title) || 'Untitled'}" — ${clean(paper?.authors) || 'Authors unavailable'} (${paper?.year || 'year unavailable'}), ${clean(paper?.source) || 'source unavailable'}.${identity}`;
  });

  const researcherLines = researchers.slice(0, 8).map((researcher, index) =>
    `[SR${index + 1}] ${clean(researcher?.name) || 'Unnamed researcher'} — ${clean(researcher?.institution) || 'institution unavailable'}.${researcher?.profile_url ? ` URL: ${researcher.profile_url}` : ''}`
  );

  const fundingLines = opportunities.slice(0, 8).map((opportunity, index) => {
    const url = clean(opportunity?.url || opportunity?.source_url);
    return `[SF${index + 1}] "${clean(opportunity?.title) || 'Untitled opportunity'}" — ${clean(opportunity?.source || opportunity?.agency) || 'source unavailable'}; deadline ${clean(opportunity?.deadline) || 'not supplied'}; amount ${clean(opportunity?.amount) || 'not supplied'}.${url ? ` Official URL: ${url}` : ''}`;
  });

  return {
    papers: paperLines.join('\n') || 'No papers have been saved to this project.',
    researchers: researcherLines.join('\n') || 'No researchers have been saved to this project.',
    funding: fundingLines.join('\n') || 'No funding opportunities have been saved to this project.',
  };
}
