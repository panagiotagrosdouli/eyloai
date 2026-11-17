import { billingActive } from './eyra-auth-boundary.mjs';
import { usageState } from './eyra-usage-boundary.mjs';
import { validatedEyraToolArguments, boundedJsonResponse } from './eyra-tool-contract.mjs';
import { UUID as RUN_UUID } from './eyra-run-ledger.mjs';

/** Owner-scoped agent tools. Writes retain explicit server-side permission checks. */
function entityFromRow(row) {
  if (!row || typeof row.id !== 'string' || !row.data || typeof row.data !== 'object' || Array.isArray(row.data)) {
    throw new Error('Project service returned an invalid record.');
  }
  return {
    ...row.data,
    id: row.id,
    created_date: row.created_date || '',
    updated_date: row.updated_date || row.created_date || '',
  };
}

function boundedWorkspaceRow(row, kind) {
  const full = entityFromRow(row);
  const str = (field, limit) => typeof full[field] === 'string'
    ? full[field].slice(0, limit) : '';
  const base = { id: row.id, created_date: full.created_date, updated_date: full.updated_date };
  if (kind === 'paper') {
    return {
      ...base, title: str('title', 1000), doi: str('doi', 255),
      authors: str('authors', 350), source: str('source', 250),
      url: str('url', 500),
      year: Number.isInteger(full.year) ? full.year : null,
    };
  }
  return {
    ...base, title: str('title', 180), status: str('status', 40),
    goal: str('goal', kind === 'project_detail' ? 1200 : 280),
    description: str('description', kind === 'project_detail' ? 2400 : 300),
    ...(kind === 'project_detail' ? {
      milestones: str('milestones', 1600),
      tasks: str('tasks', 1600),
    } : {}),
  };
}

export async function executeProjectTool(name, rawArguments, identity) {
  const args = validatedEyraToolArguments(name, rawArguments);
  if (name === 'research.search_publications') {
    const query = typeof args.query === 'string' ? args.query.trim() : '';
    if (query.length < 3 || query.length > 180) {
      throw new Error('A research query of 3–180 characters is required.');
    }
    const searchUrl = new URL('https://api.crossref.org/works');
    searchUrl.searchParams.set('query.bibliographic', query);
    searchUrl.searchParams.set('rows', '5');
    const upstream = await fetch(searchUrl, {
      headers: { accept: 'application/json' },
      signal: AbortSignal.timeout(15_000),
    });
    if (!upstream.ok) throw new Error('Crossref search is unavailable.');
    const response = await upstream.json();
    if (!Array.isArray(response?.message?.items)) throw new Error('Crossref returned invalid search data.');
    const records = response.message.items.slice(0, 5).flatMap(item => {
      const doi = typeof item.DOI === 'string' ? item.DOI.trim().toLowerCase() : '';
      const title = typeof item.title?.[0] === 'string' ? item.title[0].trim() : '';
      if (!/^10\.\d{4,9}\/[\-._;()/:A-Z0-9]+$/i.test(doi) || !title) return [];
      const year = item.published?.['date-parts']?.[0]?.[0];
      return [{
        doi, title: title.slice(0, 1000),
        authors: (Array.isArray(item.author) ? item.author : []).slice(0, 15)
          .map(author => [author.given, author.family].filter(v => typeof v === 'string').join(' '))
          .filter(Boolean),
        year: Number.isInteger(year) ? year : null,
        journal: String(item['container-title']?.[0] || '').slice(0, 300),
        url: `https://doi.org/${doi}`,
        source: 'Crossref',
        evidence_level: 'bibliographic_metadata_only',
      }];
    });
    return { query, records, count: records.length, source: 'Crossref', evidence_level: 'bibliographic_metadata_only' };
  }
  if (name === 'research.lookup_doi') {
    const doi = typeof args.doi === 'string'
      ? args.doi.trim().replace(/^https?:\/\/(?:dx\.)?doi\.org\//i, '').replace(/^doi:\s*/i, '').toLowerCase()
      : '';
    if (!/^10\.\d{4,9}\/[\-._;()/:A-Z0-9]+$/i.test(doi) || doi.length > 255) {
      throw new Error('A valid DOI is required.');
    }
    const sourceResponse = await fetch(`https://api.crossref.org/works/${encodeURIComponent(doi)}`, {
      headers: { accept: 'application/json' },
      signal: AbortSignal.timeout(15_000),
    });
    if (!sourceResponse.ok) throw new Error('Crossref could not retrieve this DOI.');
    const payload = await sourceResponse.json();
    const metadata = payload?.message;
    if (typeof metadata?.DOI !== 'string' || metadata.DOI.toLowerCase() !== doi) {
      throw new Error('Crossref returned inconsistent DOI metadata.');
    }
    const title = typeof metadata.title?.[0] === 'string' ? metadata.title[0].trim() : '';
    if (!title) throw new Error('Crossref did not provide a publication title.');
    const dateParts = metadata.published?.['date-parts']?.[0]
      || metadata['published-online']?.['date-parts']?.[0]
      || metadata['published-print']?.['date-parts']?.[0];
    return {
      doi, title: title.slice(0, 1000),
      authors: (Array.isArray(metadata.author) ? metadata.author : []).slice(0, 30)
        .map(author => [author.given, author.family].filter(v => typeof v === 'string').join(' '))
        .filter(Boolean),
      year: Number.isInteger(dateParts?.[0]) ? dateParts[0] : null,
      journal: String(metadata['container-title']?.[0] || '').slice(0, 300),
      url: `https://doi.org/${doi}`,
      source: 'Crossref',
      evidence_level: 'bibliographic_metadata_only',
    };
  }
  const url = `${identity.supabaseUrl}/rest/v1/projects`;
  const headers = {
    apikey: identity.publicKey,
    authorization: identity.bearer,
    accept: 'application/json',
    'content-type': 'application/json',
    prefer: 'return=representation',
  };

  if (['notes.list', 'tasks.list', 'calendar.list_events',
    'learning.list_flashcard_decks', 'funding.list_saved_opportunities',
    'research.list_saved_researchers'].includes(name)) {
    const table = {
      'notes.list': 'notes',
      'tasks.list': 'life_tasks',
      'calendar.list_events': 'calendar_events',
      'learning.list_flashcard_decks': 'study_flashcard_decks',
      'funding.list_saved_opportunities': 'saved_opportunities',
      'research.list_saved_researchers': 'saved_researchers',
    }[name];
    const params = new URLSearchParams({
      select: 'id,data,created_date,updated_date',
      user_id: `eq.${identity.user.id}`,
      order: 'updated_date.desc',
      limit: '20',
    });
    const upstream = await fetch(`${identity.supabaseUrl}/rest/v1/${table}?${params}`, {
      headers, cache: 'no-store', signal: AbortSignal.timeout(15_000),
    });
    if (!upstream.ok) throw new Error('Workspace records are unavailable.');
    const rows = await upstream.json();
    if (!Array.isArray(rows)) throw new Error('Workspace service returned invalid records.');
    return rows.slice(0, 20).map(row => {
      if (typeof row?.id !== 'string' || !row.data || typeof row.data !== 'object' || Array.isArray(row.data)) {
        throw new Error('Workspace service returned an invalid record.');
      }
      const item = row.data;
      return {
        id: row.id,
        title: String(item.title || item.name || '').slice(0, 180),
        status: String(item.status || '').slice(0, 40),
        due_date: String(item.due_date || item.dueDate || '').slice(0, 60),
        start_time: String(item.start_time || item.startTime || '').slice(0, 60),
        preview: name === 'notes.list' ? String(item.content || item.body || '').slice(0, 300) : '',
        source_url: ['funding.list_saved_opportunities', 'research.list_saved_researchers'].includes(name)
          ? String(item.source_url || item.url || item.profile_url || '').slice(0, 500) : '',
        metadata_status: name === 'funding.list_saved_opportunities'
          ? 'saved_record_not_live_eligibility_verification'
          : name === 'research.list_saved_researchers'
            ? 'saved_record_not_live_affiliation_verification' : '',
        updated_date: row.updated_date || '',
      };
    });
  }
  if (name === 'learning.list_lessons' || name === 'learning.list_progress') {
    if (!RUN_UUID.test(args.course_id)) throw new Error('A valid owned course UUID is required.');
    const courseParams = new URLSearchParams({
      select: 'id', id: `eq.${args.course_id}`, user_id: `eq.${identity.user.id}`, limit: '1',
    });
    const courseResponse = await fetch(
      `${identity.supabaseUrl}/rest/v1/learning_courses?${courseParams}`, {
        headers, cache: 'no-store', signal: AbortSignal.timeout(15_000),
      });
    if (!courseResponse.ok) throw new Error('Course ownership could not be verified.');
    const ownedCourses = await courseResponse.json();
    if (!Array.isArray(ownedCourses) || ownedCourses.length !== 1
      || ownedCourses[0].id !== args.course_id) {
      throw new Error('Course is not available to the authenticated user.');
    }
    const progress = name === 'learning.list_progress';
    const table = progress ? 'learning_lesson_progress' : 'learning_lessons';
    const select = progress
      ? 'id,course_id,lesson_id,status,completed_at,updated_at'
      : 'id,course_id,title,objective,position,quiz_id';
    const params = new URLSearchParams({
      select, user_id: `eq.${identity.user.id}`,
      course_id: `eq.${args.course_id}`,
      order: progress ? 'updated_at.desc' : 'position.asc',
      limit: '30',
    });
    const upstream = await fetch(`${identity.supabaseUrl}/rest/v1/${table}?${params}`, {
      headers, cache: 'no-store', signal: AbortSignal.timeout(15_000),
    });
    if (!upstream.ok) throw new Error('Learning lessons or progress are unavailable.');
    const rows = await upstream.json();
    if (!Array.isArray(rows)) throw new Error('Learning record service returned invalid results.');
    const records = rows.slice(0, 30).map(row => {
      if (!RUN_UUID.test(row?.id || '') || row.course_id !== args.course_id) {
        throw new Error('Learning record ownership or course association could not be verified.');
      }
      if (progress) {
        return {
          id: row.id,
          course_id: row.course_id,
          lesson_id: typeof row.lesson_id === 'string' ? row.lesson_id : '',
          status: typeof row.status === 'string' ? row.status.slice(0, 40) : '',
          completed_at: typeof row.completed_at === 'string' ? row.completed_at.slice(0, 40) : null,
        };
      }
      return {
        id: row.id, course_id: row.course_id,
        title: typeof row.title === 'string' ? row.title.slice(0, 180) : '',
        objective: typeof row.objective === 'string' ? row.objective.slice(0, 350) : '',
        position: Number.isInteger(row.position) ? row.position : null,
        has_assessment: typeof row.quiz_id === 'string' && RUN_UUID.test(row.quiz_id),
      };
    });
    return {
      course_id: args.course_id,
      count: records.length, records,
      total_scope: 'last_30_records_only', source: 'authenticated_learning_workspace',
      metadata_only: true,
    };
  }
  if (name === 'learning.list_courses' || name === 'learning.list_quizzes') {
    const table = name === 'learning.list_courses' ? 'learning_courses' : 'quizzes';
    const select = name === 'learning.list_courses'
      ? 'id,title,subject,description,updated_at'
      : 'id,title,subject,updated_at';
    const params = new URLSearchParams({
      select, user_id: `eq.${identity.user.id}`,
      order: 'updated_at.desc', limit: '20',
    });
    const upstream = await fetch(`${identity.supabaseUrl}/rest/v1/${table}?${params}`, {
      headers, cache: 'no-store', signal: AbortSignal.timeout(15_000),
    });
    if (!upstream.ok) throw new Error('Learning records are temporarily unavailable.');
    const rows = await upstream.json();
    if (!Array.isArray(rows)) throw new Error('Learning records returned an invalid response.');
    const records = rows.slice(0, 20).map(row => {
      if (typeof row?.id !== 'string' || !RUN_UUID.test(row.id)) {
        throw new Error('Learning records included an invalid ID.');
      }
      return {
        id: row.id,
        title: typeof row.title === 'string' ? row.title.slice(0, 180) : '',
        subject: typeof row.subject === 'string' ? row.subject.slice(0, 180) : '',
        ...(table === 'learning_courses' ? {
          description: typeof row.description === 'string' ? row.description.slice(0, 300) : '',
        } : {}),
        updated_at: typeof row.updated_at === 'string' ? row.updated_at.slice(0, 40) : '',
      };
    });
    return { records, count: records.length, metadata_only: true, source: 'authenticated_learning_workspace' };
  }
  if (name === 'notes.search' || name === 'library.search_papers') {
    const query = typeof args.query === 'string' ? args.query.trim().toLocaleLowerCase() : '';
    if (query.length < 3 || query.length > 120) {
      throw new Error('A search query of 3–120 characters is required.');
    }
    const table = name === 'notes.search' ? 'notes' : 'saved_papers';
    const params = new URLSearchParams({
      select: 'id,data,updated_date',
      user_id: `eq.${identity.user.id}`,
      order: 'updated_date.desc', limit: '100',
    });
    const upstream = await fetch(`${identity.supabaseUrl}/rest/v1/${table}?${params}`, {
      headers, cache: 'no-store', signal: AbortSignal.timeout(15_000),
    });
    if (!upstream.ok) throw new Error('Saved research search is unavailable.');
    const rows = await boundedJsonResponse(upstream);
    if (!Array.isArray(rows)) throw new Error('Saved research search returned an invalid list.');
    const matching = rows.slice(0, 100).filter(row => {
      if (typeof row?.id !== 'string' || !row.data || typeof row.data !== 'object'
        || Array.isArray(row.data)) throw new Error('Saved research search returned an invalid record.');
      const fields = table === 'notes'
        ? [row.data.title, row.data.name, row.data.content, row.data.body]
        : [row.data.title, row.data.authors, row.data.doi];
      return fields.some(value => typeof value === 'string'
        && value.toLocaleLowerCase().includes(query));
    }).slice(0, 10);
    const records = matching.map(row => table === 'notes'
      ? {
        id: row.id, title: String(row.data.title || row.data.name || '').slice(0, 180),
        preview: String(row.data.content || row.data.body || '').slice(0, 300),
        updated_date: String(row.updated_date || '').slice(0, 40),
      }
      : boundedWorkspaceRow(row, 'paper'));
    return {
      query: args.query.trim(), count: records.length, records,
      scanned_recent_records: Math.min(rows.length, 100),
      total_scope: 'last_100_records_only',
      evidence_level: table === 'notes' ? 'user_saved_notes' : 'saved_bibliographic_metadata_only',
    };
  }
  if (name === 'project.get') {
    const id = typeof args.id === 'string' ? args.id.trim() : '';
    if (!/^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(id)) {
      throw new Error('A valid project UUID is required.');
    }
    const params = new URLSearchParams({
      select: 'id,data,created_date,updated_date',
      id: `eq.${id}`,
      user_id: `eq.${identity.user.id}`,
      limit: '1',
    });
    const result = await fetch(`${url}?${params}`, {
      headers, cache: 'no-store', signal: AbortSignal.timeout(15_000),
    });
    if (!result.ok) throw new Error('Project details are unavailable.');
    const rows = await result.json();
    if (!Array.isArray(rows)) throw new Error('Project service returned an invalid response.');
    if (!rows.length) throw new Error('Project not found or not accessible.');
    return boundedWorkspaceRow(rows[0], 'project_detail');
  }
  if (name === 'project.list') {
    const result = await fetch(`${url}?select=id,data,created_date,updated_date&user_id=eq.${encodeURIComponent(identity.user.id)}&order=updated_date.desc&limit=50`, {
      headers, cache: 'no-store', signal: AbortSignal.timeout(15_000),
    });
    if (!result.ok) throw new Error(`Project list failed (${result.status}).`);
    const rows = await result.json();
    if (!Array.isArray(rows)) throw new Error('Project service returned an invalid list.');
    return rows.slice(0, 50).map(row => boundedWorkspaceRow(row, 'project'));
  }

  if (name === 'project.create') {
    if (!identity.explicitProjectCreate) throw new Error('Project creation requires both an explicit current create request and user confirmation.');
    if (billingActive() && usageState(identity).plan === 'free') {
      const existingResponse = await fetch(`${url}?select=id&user_id=eq.${encodeURIComponent(identity.user.id)}&limit=1`, {
        headers, cache: 'no-store', signal: AbortSignal.timeout(15_000),
      });
      if (!existingResponse.ok) throw new Error(`Project entitlement check failed (${existingResponse.status}).`);
      const existing = await existingResponse.json();
      if (Array.isArray(existing) && existing.length) throw new Error('The free plan includes one project workspace. Upgrade to create another.');
    }
    const title = typeof args.title === 'string' ? args.title.trim() : '';
    if (!title || title.length > 180) throw new Error('A project title of 1–180 characters is required.');
    const project = {
      title,
      description: String(args.description || '').trim().slice(0, 4000),
      goal: String(args.goal || '').trim().slice(0, 2000),
      milestones: String(args.milestones || '').trim().slice(0, 6000),
      tasks: String(args.tasks || '').trim().slice(0, 6000),
      status: 'planning',
    };
    const result = await fetch(`${url}?select=id,data,created_date,updated_date`, {
      method: 'POST', headers,
      body: JSON.stringify({ user_id: identity.user.id, data: project }),
      signal: AbortSignal.timeout(15_000),
    });
    if (!result.ok) throw new Error(`Project creation failed (${result.status}).`);
    const rows = await result.json();
    const created = entityFromRow(Array.isArray(rows) ? rows[0] : null);
    if (created.title !== title) throw new Error('Project persistence could not be verified.');
    return { ...created, verified: true };
  }

  if (name === 'library.list_papers') {
    const papersUrl = `${identity.supabaseUrl}/rest/v1/saved_papers`;
    const result = await fetch(`${papersUrl}?select=id,data,created_date,updated_date&user_id=eq.${encodeURIComponent(identity.user.id)}&order=updated_date.desc&limit=50`, {
      headers, cache: 'no-store', signal: AbortSignal.timeout(15_000),
    });
    if (!result.ok) throw new Error(`Library list failed (${result.status}).`);
    const rows = await result.json();
    if (!Array.isArray(rows)) throw new Error('Library service returned an invalid list.');
    return rows.slice(0, 50).map(row => boundedWorkspaceRow(row, 'paper'));
  }

  if (name === 'library.save_paper') {
    if (!identity.explicitPaperSave) throw new Error('Saving a paper requires both an explicit current save request and user confirmation.');
    const doi = String(args.doi || '').trim().replace(/^https?:\/\/(?:dx\.)?doi\.org\//i, '').replace(/^doi:\s*/i, '').toLowerCase();
    if (!/^10\.\d{4,9}\/[\-._;()/:A-Z0-9]+$/i.test(doi)) throw new Error('A valid DOI is required to verify and save this paper.');
    const sourceResponse = await fetch(`https://api.crossref.org/works/${encodeURIComponent(doi)}`, {
      headers: { accept: 'application/json' },
      signal: AbortSignal.timeout(15_000),
    });
    if (!sourceResponse.ok) throw new Error('Crossref could not verify this DOI. The paper was not saved.');
    const sourcePayload = await sourceResponse.json();
    const metadata = sourcePayload?.message;
    if (typeof metadata?.DOI !== 'string' || metadata.DOI.trim().toLowerCase() !== doi) {
      throw new Error('Crossref returned a different DOI. The paper was not saved.');
    }
    const verifiedTitle = String(metadata?.title?.[0] || '').trim();
    const normalizeTitle = (value) => String(value || '').toLowerCase().normalize('NFKD').replace(/[^\p{L}\p{N}]+/gu, '');
    if (!verifiedTitle || normalizeTitle(verifiedTitle) !== normalizeTitle(args.title)) {
      throw new Error('The supplied title does not match Crossref metadata. The paper was not saved.');
    }

    const papersUrl = `${identity.supabaseUrl}/rest/v1/saved_papers`;
    const duplicateQuery = new URLSearchParams({
      select: 'id,data,created_date,updated_date',
      user_id: `eq.${identity.user.id}`,
      'data->>doi': `eq.${doi}`,
      limit: '1',
    });
    const duplicateResponse = await fetch(`${papersUrl}?${duplicateQuery}`, {
      headers, cache: 'no-store', signal: AbortSignal.timeout(15_000),
    });
    if (!duplicateResponse.ok) throw new Error(`Library duplicate check failed (${duplicateResponse.status}).`);
    const duplicates = await duplicateResponse.json();
    if (!Array.isArray(duplicates)) throw new Error('Library duplicate check returned an invalid result.');
    if (duplicates.length) return { ...entityFromRow(duplicates[0]), verified: true, already_saved: true };

    const authorNames = (metadata.author || []).slice(0, 40).map((author) => [author.given, author.family].filter(Boolean).join(' ')).filter(Boolean);
    const publishedParts = metadata.published?.['date-parts']?.[0]
      || metadata['published-print']?.['date-parts']?.[0]
      || metadata['published-online']?.['date-parts']?.[0]
      || [];
    const record = {
      source_id: `doi:${doi}`,
      title: verifiedTitle.slice(0, 1000),
      authors: authorNames.join(', ').slice(0, 4000),
      doi,
      year: Number(publishedParts[0]) || null,
      source: String(metadata['container-title']?.[0] || 'Crossref').slice(0, 300),
      url: `https://doi.org/${doi}`,
      summary: '',
    };
    const saveResponse = await fetch(`${papersUrl}?select=id,data,created_date,updated_date`, {
      method: 'POST', headers,
      body: JSON.stringify({ user_id: identity.user.id, data: record }),
      signal: AbortSignal.timeout(15_000),
    });
    if (!saveResponse.ok) throw new Error(`Library save failed (${saveResponse.status}).`);
    const savedRows = await saveResponse.json();
    const saved = entityFromRow(Array.isArray(savedRows) ? savedRows[0] : null);
    if (saved.doi !== doi || saved.title !== record.title) throw new Error('Library persistence could not be verified.');
    return { ...saved, verified: true, already_saved: false };
  }

  throw new Error('Unsupported project tool.');
}

