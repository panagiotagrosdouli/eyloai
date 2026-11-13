import { normalizeDoi } from './citation-verification.mjs';
import { isSafeLiteratureSourceUrl } from './literature-review-protocol.mjs';

export function researchPaperIdentity(paper = {}) {
  const doi = normalizeDoi(paper.doi || paper.DOI);
  if (doi) return { doi, sourceId: `doi:${doi}` };
  const key = [paper.id, paper.url].find((value) => typeof value === 'string' && value.trim());
  return { doi: '', sourceId: typeof key === 'string' ? key.trim() : '' };
}

function matchingRecord(matches, identity) {
  if (!Array.isArray(matches)) return null;
  return matches.find((record) => record.source_id === identity.sourceId)
    || (identity.doi ? matches.find((record) => normalizeDoi(record.doi) === identity.doi) : null)
    || null;
}

export async function saveDiscoveredGapPaper({ entities, paper, project = null }) {
  if (!entities?.SavedPaper || !paper || typeof paper.title !== 'string' || !paper.title.trim()) {
    throw new Error('The scholarly source record is incomplete.');
  }
  const identity = researchPaperIdentity(paper);
  const sourceId = identity.sourceId;
  if (!sourceId) throw new Error('The source record has no stable identifier.');

  const findExisting = async () => {
    const lookups = [entities.SavedPaper.filter({ source_id: sourceId }, '-created_date', 100)];
    if (identity.doi) {
      for (const doi of [identity.doi, `doi:${identity.doi}`, `https://doi.org/${identity.doi}`, `https://dx.doi.org/${identity.doi}`]) {
        lookups.push(entities.SavedPaper.filter({ doi }, '-created_date', 100));
      }
    }
    const matchSets = await Promise.all(lookups);
    return matchingRecord(matchSets.flat(), identity);
  };
  const existing = await findExisting();
  if (existing) {
    if (project && existing.project_id && existing.project_id !== project.id) {
      throw Object.assign(new Error('This source is already linked to another project; its existing association was preserved.'), { code: 'PAPER_PROJECT_CONFLICT', record: existing });
    }
    if (project && !existing.project_id) {
      return entities.SavedPaper.update(existing.id, { project_id: project.id, project_title: project.title || '' });
    }
    return existing;
  }

  try {
    return await entities.SavedPaper.create({
      source_id: sourceId,
      title: paper.title.trim().slice(0, 1000),
      authors: typeof paper.authors === 'string' ? paper.authors : '',
      summary: typeof paper.summary === 'string' ? paper.summary : '',
      year: paper.year || null,
      doi: identity.doi || (typeof paper.doi === 'string' ? paper.doi : ''),
      source: paper.source_index || paper.source || '',
      source_index: paper.source_index || paper.source || '',
      indexed_by: Array.isArray(paper.indexed_by) ? paper.indexed_by : [],
      source_records: Array.isArray(paper.source_records) ? paper.source_records : [],
      summary_source: typeof paper.summary_source === 'string' ? paper.summary_source : '',
      metadata_conflict: Boolean(paper.metadata_conflict),
      authorships: Array.isArray(paper.authorships) ? paper.authorships : [],
      openalex_topics: Array.isArray(paper.openalex_topics) ? paper.openalex_topics : [],
      referenced_work_ids: Array.isArray(paper.referenced_work_ids) ? paper.referenced_work_ids : [],
      url: isSafeLiteratureSourceUrl(paper.url) ? paper.url : '',
      cited_by_count: Number.isFinite(paper.cited_by_count) ? paper.cited_by_count : null,
      open_access: typeof paper.open_access === 'boolean' ? paper.open_access : null,
      ...(project ? { project_id: project.id, project_title: project.title || '' } : {}),
    });
  } catch (error) {
    // A per-user source identity unique index closes the read-then-insert race.
    // Re-read and apply the same project-isolation rules for the winning row.
    if (error?.code !== '23505') throw error;
    const raced = await findExisting();
    if (!raced) throw error;
    if (project && raced.project_id && raced.project_id !== project.id) {
      throw Object.assign(new Error('This source is already linked to another project; its existing association was preserved.'), { code: 'PAPER_PROJECT_CONFLICT', record: raced });
    }
    if (project && !raced.project_id) {
      return entities.SavedPaper.update(raced.id, { project_id: project.id, project_title: project.title || '' });
    }
    return raced;
  }
}

// Shared canonical Library saver; retain the historical export for callers.
export const saveScholarlyPaper = saveDiscoveredGapPaper;
