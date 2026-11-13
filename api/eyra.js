import { applyCors } from '../src/lib/api-cors.mjs';
import { readSupabaseApiConfig } from './supabase-config.mjs';
import crypto from 'node:crypto';
import { FREE_MONTHLY_AI_ACTIONS } from '../src/lib/eyra-usage-policy.mjs';
import { matchesEyraResponseSchema } from '../src/lib/eyra-structured-contract.mjs';
import { relayEyraResponse } from '../src/lib/eyra-stream.mjs';

const MAX_PROMPT_LENGTH = 24_000;
const MAX_SCHEMA_LENGTH = 32_000;
const MAX_SCHEMA_DEPTH = 8;
const PLAN_LIMITS = { free: FREE_MONTHLY_AI_ACTIONS, pro: null, founder: null, institution: null };
const PROJECT_TOOLS = [
  {
    type: 'function',
    name: 'project.list',
    description: 'List the authenticated user’s projects. Use when a request asks about their existing projects.',
    parameters: { type: 'object', properties: {}, required: [], additionalProperties: false },
    strict: true,
  },
  {
    type: 'function',
    name: 'project.create',
    description: 'Create a project in the authenticated user’s workspace when they explicitly ask EYRA to create one.',
    parameters: {
      type: 'object',
      properties: {
        title: { type: 'string' },
        description: { type: 'string' },
        goal: { type: 'string' },
        milestones: { type: 'string' },
        tasks: { type: 'string' },
      },
      required: ['title', 'description', 'goal', 'milestones', 'tasks'],
      additionalProperties: false,
    },
    strict: true,
  },
  {
    type: 'function',
    name: 'library.list_papers',
    description: 'List saved papers in the authenticated user’s Library when they ask what papers they saved.',
    parameters: { type: 'object', properties: {}, required: [], additionalProperties: false },
    strict: true,
  },
  {
    type: 'function',
    name: 'library.save_paper',
    description: 'Save a DOI identified paper to the authenticated user’s Library when they explicitly ask to save it.',
    parameters: {
      type: 'object',
      properties: {
        doi: { type: 'string' },
        title: { type: 'string' },
      },
      required: ['doi', 'title'],
      additionalProperties: false,
    },
    strict: true,
  },
];

const EYRA_INSTRUCTIONS = `You are EYRA, the research and innovation intelligence inside EYLO.

Act as a rigorous research analyst, strategic advisor, funding guide, startup co-founder, and team builder.

Rules:
- Never invent papers, researchers, institutions, grants, deadlines, statistics, or source URLs.
- Treat records supplied in the prompt as the only verified project and research context.
- Distinguish verified evidence, model inference, and user-provided assumptions.
- If current factual information is not included in the evidence, state what must be verified and where.
- Lead with the most important insight.
- Give concise reasoning, practical next steps, and an evidence-support level when evidence is supplied.
- Match the user's language.
- If the request is materially underspecified, ask one focused clarification instead of producing a generic long answer.
- For academic questions, organize the answer around the research question, evidence, methods, limitations, and the next defensible step.
- For strategy questions, state the decision, options, trade-offs, assumptions, and the cheapest useful validation.
- Avoid hype, flattery, generic motivation, and claims that the system is continuously monitoring anything.
- For structured requests, populate every required field with useful, specific analysis.
- Use project tools only when the user explicitly requests listing their projects or creating a project. Never infer permission to create from a request for advice or a draft.
- Use Library save tools only when the user explicitly asks to save a paper; save only DOI records whose title and metadata are verified against Crossref.
- Report a project as created only when the project tool returns a verified record and identifier.
- Report a paper as saved only when the Library write returns a persisted record and identifier.
- Never describe a fallback or template as live research.
- End free-form answers with one concrete next action or a focused strategic question.`;

function outputText(openAiResponse) {
  return (openAiResponse.output || [])
    .flatMap((item) => item.content || [])
    .filter((item) => item.type === 'output_text')
    .map((item) => item.text)
    .join('\n')
    .trim();
}

function outputRefusal(openAiResponse) {
  return (openAiResponse.output || [])
    .flatMap((item) => item.content || [])
    .find((item) => item.type === 'refusal')?.refusal;
}

function normalizeSchema(schema, depth = 0) {
  if (!schema || typeof schema !== 'object' || Array.isArray(schema)) {
    throw new Error('Invalid response schema.');
  }
  if (depth > MAX_SCHEMA_DEPTH) throw new Error('Response schema is too deeply nested.');

  const normalized = {};
  const scalarKeys = [
    'type', 'description', 'enum', 'minimum', 'maximum',
    'minLength', 'maxLength', 'minItems', 'maxItems',
  ];

  scalarKeys.forEach((key) => {
    if (schema[key] !== undefined) normalized[key] = schema[key];
  });

  if (schema.properties || schema.type === 'object') {
    const properties = schema.properties || {};
    normalized.type = 'object';
    normalized.properties = Object.fromEntries(
      Object.entries(properties).map(([key, value]) => [key, normalizeSchema(value, depth + 1)])
    );
    normalized.required = Object.keys(properties);
    normalized.additionalProperties = false;
  }

  if (schema.items || schema.type === 'array') {
    normalized.type = 'array';
    normalized.items = normalizeSchema(schema.items || { type: 'string' }, depth + 1);
  }

  return normalized;
}

function supabaseServerKey() {
  return process.env.SUPABASE_SECRET_KEY
    || process.env.SUPABASE_SERVICE_ROLE_KEY;
}

function serverHeaders(key) {
  const headers = {
    apikey: key,
    accept: 'application/json',
    'content-type': 'application/json',
  };
  if (!key.startsWith('sb_')) headers.authorization = `Bearer ${key}`;
  return headers;
}

function billingActive() {
  return Boolean(
    process.env.STRIPE_SECRET_KEY
    && process.env.STRIPE_WEBHOOK_SECRET
    && process.env.STRIPE_PRO_PRICE_ID
    && process.env.STRIPE_FOUNDER_PRICE_ID
    && supabaseServerKey()
  );
}

async function authenticate(authorization) {
  const bearer = Array.isArray(authorization) ? authorization[0] : authorization;
  if (!bearer?.startsWith('Bearer ') || !bearer.slice(7).trim()) {
    console.warn('EYRA auth rejected', { reason: 'missing_bearer' });
    return null;
  }

  const config = readSupabaseApiConfig();
  if (!config.hasPublicConfig) {
    console.error('EYRA auth rejected', { reason: 'missing_supabase_public_key' });
    return null;
  }
  const { publicKey, url: supabaseUrl } = config;

  const authResponse = await fetch(`${supabaseUrl}/auth/v1/user`, {
    headers: { authorization: bearer, apikey: publicKey },
    cache: 'no-store',
    signal: AbortSignal.timeout(15_000),
  });
  if (!authResponse.ok) {
    console.warn('EYRA auth rejected', { reason: 'supabase_user_rejected', status: authResponse.status });
    return null;
  }
  const user = await authResponse.json();

  let entitlement = {};
  const serverKey = supabaseServerKey();
  if (billingActive()) {
    const entitlementResponse = await fetch(
      `${supabaseUrl}/rest/v1/billing_entitlements?user_id=eq.${encodeURIComponent(user.id)}&select=*&limit=1`,
      { headers: serverHeaders(serverKey) },
    );
    if (!entitlementResponse.ok) {
      throw new Error('Could not load EYRA billing entitlement.');
    }
    const rows = await entitlementResponse.json();
    entitlement = rows?.[0] || {};
  }

  return { user, entitlement, serverKey, supabaseUrl, bearer, publicKey };
}

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

function userExplicitlyRequestedProjectCreation(prompt) {
  const text = String(prompt || '').toLowerCase();
  if (/\b(?:don't|do not|never|should not|shouldn't)\b/.test(text) || /\bμη(?:ν|ν)?\b/.test(text)) return false;
  return /\b(?:create|make|start|set up|open)\b.{0,100}\bproject\b|\bnew project\b|\bproject\b.{0,100}\b(?:create|make|start|set up|open)\b|(?:δημιουργ(?:ησε|ήστε|ήσω)|φτιαξε|φτιάξε|ανοιξε|άνοιξε)\b.{0,100}έργο|νέο έργο/.test(text);
}

function userExplicitlyRequestedPaperSave(prompt) {
  const text = String(prompt || '').toLowerCase();
  if (/\b(?:don't|do not|never|should not|shouldn't)\b/.test(text) || /\bμη(?:ν)?\b/.test(text)) return false;
  return /\b(?:save|add|put|store)\b.{0,100}\b(?:paper|article|publication)\b|\b(?:paper|article|publication)\b.{0,100}\b(?:save|add|put|store)\b|\bmy library\b|\bστη βιβλιοθήκη μου\b|\bαποθήκευσ(?:ε|ετέ)\b.{0,100}\b(?:άρθρο|δημοσίευση|εργασία)\b|\b(?:άρθρο|δημοσίευση|εργασία)\b.{0,100}\bαποθήκευσ/.test(text);
}

async function executeProjectTool(name, rawArguments, identity) {
  let args;
  try { args = JSON.parse(rawArguments || '{}'); } catch { throw new Error('Invalid tool arguments.'); }
  const url = `${identity.supabaseUrl}/rest/v1/projects`;
  const headers = {
    apikey: identity.publicKey,
    authorization: identity.bearer,
    accept: 'application/json',
    'content-type': 'application/json',
    prefer: 'return=representation',
  };

  if (name === 'project.list') {
    const result = await fetch(`${url}?select=id,data,created_date,updated_date&user_id=eq.${encodeURIComponent(identity.user.id)}&order=updated_date.desc&limit=50`, {
      headers, cache: 'no-store', signal: AbortSignal.timeout(15_000),
    });
    if (!result.ok) throw new Error(`Project list failed (${result.status}).`);
    const rows = await result.json();
    if (!Array.isArray(rows)) throw new Error('Project service returned an invalid list.');
    return rows.map(entityFromRow);
  }

  if (name === 'project.create') {
    if (!identity.explicitProjectCreate) throw new Error('Project creation requires an explicit create request from the user.');
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
    return rows.map(entityFromRow);
  }

  if (name === 'library.save_paper') {
    if (!identity.explicitPaperSave) throw new Error('Saving a paper requires an explicit save request from the user.');
    const doi = String(args.doi || '').trim().replace(/^https?:\/\/(?:dx\.)?doi\.org\//i, '').replace(/^doi:\s*/i, '').toLowerCase();
    if (!/^10\.\d{4,9}\/[\-._;()/:A-Z0-9]+$/i.test(doi)) throw new Error('A valid DOI is required to verify and save this paper.');
    const sourceResponse = await fetch(`https://api.crossref.org/works/${encodeURIComponent(doi)}`, {
      headers: { accept: 'application/json' },
      signal: AbortSignal.timeout(15_000),
    });
    if (!sourceResponse.ok) throw new Error('Crossref could not verify this DOI. The paper was not saved.');
    const sourcePayload = await sourceResponse.json();
    const metadata = sourcePayload?.message;
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
      source_id: doi,
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

function usageState(identity) {
  const month = new Date().toISOString().slice(0, 7);
  const billingEnabled = billingActive();
  const plan = billingEnabled && PLAN_LIMITS[identity.entitlement.plan] !== undefined
    ? identity.entitlement.plan
    : 'free';
  return {
    month,
    plan,
    used: 0,
    limit: PLAN_LIMITS[plan],
  };
}

async function reserveUsage(identity, usage) {
  const actionId = crypto.randomUUID();
  const result = await fetch(
    `${identity.supabaseUrl}/rest/v1/rpc/reserve_eyra_usage`,
    {
      method: 'POST',
      headers: serverHeaders(identity.serverKey),
      body: JSON.stringify({
        p_action_id: actionId,
        p_user_id: identity.user.id,
        p_usage_month: usage.month,
        p_limit: usage.limit,
      }),
      signal: AbortSignal.timeout(15_000),
    },
  );
  if (!result.ok) throw new Error(`Usage reservation failed: ${result.status}`);

  const payload = await result.json();
  const reservation = Array.isArray(payload) ? payload[0] : payload;
  return {
    allowed: reservation?.allowed === true,
    used: Number(reservation?.used || 0),
    actionId: reservation?.allowed === true ? actionId : null,
    serverKey: identity.serverKey,
    supabaseUrl: identity.supabaseUrl,
  };
}

async function releaseUsage(reservation) {
  if (!reservation?.actionId) return;

  try {
    const rollback = await fetch(
      `${reservation.supabaseUrl}/rest/v1/rpc/release_eyra_usage`,
      {
        method: 'POST',
        headers: serverHeaders(reservation.serverKey),
        body: JSON.stringify({ p_action_id: reservation.actionId }),
        signal: AbortSignal.timeout(15_000),
      },
    );
    // HTTP failures do not throw in fetch. Report unsuccessful quota refunds
    // so operators can investigate unexpected usage counts.
    if (!rollback.ok) {
      console.error('EYRA usage rollback was rejected', {
        status: rollback.status,
        actionId: reservation.actionId,
      });
    }
  } catch {
    console.error('EYRA usage rollback failed', { actionId: reservation.actionId });
  }
}

export default async function handler(request, response) {
  if (applyCors(request, response, ["POST"])) return;
  if (request.method !== 'POST') {
    response.setHeader('Allow', 'POST');
    return response.status(405).json({ error: 'Method not allowed.' });
  }

  // EYRA responses can include private research and billing usage metadata.
  // Never allow a browser or intermediary to cache success or error responses.
  response.setHeader('Cache-Control', 'private, no-store');

  const authorization = request.headers?.authorization;
  if (typeof authorization !== 'string' || !/^Bearer \S+$/.test(authorization)) {
    return response.status(401).json({ error: 'Authentication required.' });
  }

  if (!readSupabaseApiConfig().hasPublicConfig) {
    return response.status(503).json({
      error: 'EYRA authentication is awaiting verified database configuration.',
      code: 'SUPABASE_NOT_CONFIGURED',
    });
  }

  let reservation = null;
  let streamTimer;
  let streamController;
  const stopStream = () => { if (!response.writableEnded) streamController?.abort(); };

  try {
    const identity = await authenticate(request.headers.authorization);
    if (!identity) {
      return response.status(401).json({ error: 'Authentication required.' });
    }

    const apiKey = process.env.OPENAI_API_KEY;
    if (!apiKey) return response.status(503).json({ error: 'EYRA AI is not configured.' });

    // Reject malformed input rather than silently coercing objects and arrays
    // into unusable prompts (which could otherwise consume an EYRA action).
    if (typeof request.body?.prompt !== 'string') {
      return response.status(400).json({ error: 'A text prompt is required.', code: 'INVALID_PROMPT' });
    }
    const prompt = request.body.prompt.trim();
    if (!prompt) return response.status(400).json({ error: 'A prompt is required.' });
    if (prompt.length > MAX_PROMPT_LENGTH) {
      return response.status(413).json({
        error: 'This research request is too long. Shorten the prompt and try again.',
        code: 'PROMPT_TOO_LONG',
        max_length: MAX_PROMPT_LENGTH,
      });
    }
    const toolIntent = request.body?.tool_intent;
    if (request.body?.enable_project_tools === true && toolIntent !== undefined && (typeof toolIntent !== 'string' || toolIntent.length > 1000)) {
      return response.status(400).json({ error: 'The current action request is invalid.', code: 'INVALID_TOOL_INTENT' });
    }
    identity.explicitProjectCreate = userExplicitlyRequestedProjectCreation(toolIntent);
    identity.explicitPaperSave = userExplicitlyRequestedPaperSave(toolIntent);

    const requestedSchema = request.body?.response_json_schema;
    const stream = request.body?.stream === true;
    if (request.body?.stream !== undefined && typeof request.body.stream !== 'boolean') return response.status(400).json({ error: 'Streaming must be a boolean.' });
    if (stream && (request.body?.enable_project_tools === true || requestedSchema)) return response.status(400).json({ error: 'Streaming is available for text conversations without record-modifying tools or structured output.', code: 'INVALID_STREAM_MODE' });
    let responseSchema;

    if (requestedSchema !== undefined && requestedSchema !== null) {
      if (typeof requestedSchema !== 'object' || Array.isArray(requestedSchema)) {
        return response.status(400).json({ error: 'The response structure must be an object.', code: 'INVALID_SCHEMA' });
      }
      if (JSON.stringify(requestedSchema).length > MAX_SCHEMA_LENGTH) {
        return response.status(400).json({ error: 'The requested response structure is too large.' });
      }
      try {
        responseSchema = normalizeSchema(requestedSchema);
      } catch (error) {
        return response.status(400).json({
          error: error?.message || 'Invalid response schema.',
          code: 'INVALID_SCHEMA',
        });
      }
    }

    if (!identity.serverKey) {
      return response.status(503).json({
        error: 'EYRA usage controls are not configured.',
        code: 'USAGE_CONTROLS_UNAVAILABLE',
      });
    }

    const usage = usageState(identity);
    reservation = await reserveUsage(identity, usage);
    if (!reservation.allowed) {
      return response.status(429).json({
        error: `The free plan includes ${usage.limit} EYRA AI actions per month. Upgrade to continue.`,
        code: 'PLAN_LIMIT_REACHED',
        plan: usage.plan,
        usage: { used: reservation.used, limit: usage.limit, month: usage.month },
        upgrade_url: '/pricing',
      });
    }

    /** @type {Record<string, any>} */
    const requestBody = {
      model: process.env.OPENAI_MODEL || 'gpt-5.6',
      instructions: EYRA_INSTRUCTIONS,
      input: prompt,
      store: false,
      max_output_tokens: 4096,
      ...(stream ? { stream: true } : {}),
      ...(request.body?.enable_project_tools === true ? { tools: PROJECT_TOOLS, tool_choice: 'auto' } : {}),
    };

    if (request.body?.enable_project_tools !== undefined && typeof request.body.enable_project_tools !== 'boolean') {
      await releaseUsage(reservation);
      reservation = null;
      return response.status(400).json({ error: 'Project tool access must be enabled explicitly.', code: 'INVALID_TOOL_MODE' });
    }

    if (responseSchema) {
      requestBody.text = {
        format: {
          type: 'json_schema',
          name: 'eyra_result',
          strict: true,
          schema: responseSchema,
        },
      };
    }

    if (stream) {
      streamController = new AbortController();
      streamTimer = setTimeout(() => streamController.abort(), 60_000);
      response.on?.('close', stopStream);
    }
    const openAiResponse = await fetch('https://api.openai.com/v1/responses', {
      method: 'POST',
      headers: {
        authorization: `Bearer ${apiKey}`,
        'content-type': 'application/json',
      },
      body: JSON.stringify(requestBody),
      signal: stream ? streamController.signal : AbortSignal.timeout(60_000),
    });

    if (!openAiResponse.ok) {
      const requestId = openAiResponse.headers.get('x-request-id');
      console.error('OpenAI request failed', { status: openAiResponse.status, requestId });
      await releaseUsage(reservation);
      reservation = null;
      return response.status(502).json({ error: 'EYRA could not complete this request.' });
    }

    if (stream) {
      response.status(200);
      response.setHeader('Content-Type', 'text/event-stream; charset=utf-8');
      response.setHeader('X-Accel-Buffering', 'no');
      response.setHeader('X-Content-Type-Options', 'nosniff');
      const send = value => { if (!response.destroyed) response.write(`data: ${JSON.stringify(value)}\n\n`); };
      try {
        const final = await relayEyraResponse(openAiResponse.body, delta => send({ type: 'delta', delta }));
        send({ type: 'done', ...final });
      } catch {
        await releaseUsage(reservation); reservation = null;
        send({ type: 'error', error: 'EYRA did not complete the response. The draft was not saved.', code: 'EYRA_INCOMPLETE' });
      }
      response.end();
      return;
    }

    let result = await openAiResponse.json();
    // A 200 HTTP response can still contain a failed or incomplete generation.
    // Never publish partial model output as a finished research analysis.
    if (result.status && result.status !== 'completed') {
      console.warn('EYRA generation did not complete', {
        status: result.status,
        reason: result.incomplete_details?.reason || result.error?.code || 'unknown',
        responseId: result.id,
      });
      await releaseUsage(reservation);
      reservation = null;
      return response.status(502).json({
        error: 'EYRA did not finish generating the analysis. Please retry.',
        code: 'EYRA_INCOMPLETE',
      });
    }
    const actionResults = [];
    // Only the two allowlisted, authenticated project operations above can be
    // executed. Each call is scoped by the caller's bearer token and Supabase RLS.
    for (let round = 0; round < 3; round += 1) {
      const calls = (result.output || []).filter((item) => item.type === 'function_call');
      if (!calls.length) break;
      if (calls.length + actionResults.length > 8) {
        return response.status(502).json({ error: 'EYRA reached its workspace action budget. Check any confirmed actions before retrying.', code: 'TOOL_BUDGET_EXCEEDED', actions: actionResults });
      }
      if (request.body?.enable_project_tools !== true) {
        return response.status(502).json({ error: 'EYRA requested a tool that is not enabled.', code: 'TOOL_NOT_ENABLED' });
      }
      const outputs = [];
      for (const call of calls) {
        try {
          if (call.name === 'project.create' && actionResults.some((action) => action.tool === 'project.create' && action.status === 'succeeded')) {
            throw new Error('Only one project can be created in a single EYRA request.');
          }
          const value = await executeProjectTool(call.name, call.arguments, identity);
          actionResults.push({ action_id: call.call_id, tool: call.name, status: 'succeeded', result: value });
          outputs.push({ type: 'function_call_output', call_id: call.call_id, output: JSON.stringify({ ok: true, result: value }) });
        } catch (error) {
          const safeError = error instanceof Error ? error.message : 'The project action failed.';
          actionResults.push({ action_id: call.call_id, tool: call.name, status: 'failed', error: safeError });
          outputs.push({ type: 'function_call_output', call_id: call.call_id, output: JSON.stringify({ ok: false, error: safeError }) });
        }
      }
      const followup = await fetch('https://api.openai.com/v1/responses', {
        method: 'POST',
        headers: { authorization: `Bearer ${apiKey}`, 'content-type': 'application/json' },
        body: JSON.stringify({
          model: process.env.OPENAI_MODEL || 'gpt-5.6',
          instructions: EYRA_INSTRUCTIONS,
          // Keep the endpoint stateless (`store: false`) and carry the tool
          // exchange explicitly instead of relying on response retrieval.
          input: [
            { role: 'user', content: prompt },
            ...(result.output || []).filter((item) => item.type === 'function_call'),
            ...outputs,
          ],
          tools: PROJECT_TOOLS,
          tool_choice: 'auto',
          store: false,
          max_output_tokens: 4096,
        }),
        signal: AbortSignal.timeout(60_000),
      });
      if (!followup.ok) {
        console.error('OpenAI tool follow-up failed', { status: followup.status, requestId: followup.headers.get('x-request-id') });
        return response.status(502).json({ error: 'The project action ran, but EYRA could not prepare its final response.', code: 'TOOL_FOLLOWUP_FAILED', actions: actionResults });
      }
      result = await followup.json();
      if (result.status && result.status !== 'completed') {
        return response.status(502).json({ error: 'The project action ran, but EYRA did not finish its final response.', code: 'EYRA_INCOMPLETE', actions: actionResults });
      }
    }

    if ((result.output || []).some((item) => item.type === 'function_call')) {
      return response.status(502).json({
        error: 'EYRA reached its tool-step limit before completing the response.',
        code: 'TOOL_STEP_LIMIT',
        actions: actionResults,
      });
    }

    const refusal = outputRefusal(result);
    if (refusal) {
      if (actionResults.length) {
        return response.status(502).json({
          error: 'A project action ran, but EYRA could not prepare its final response.',
          code: 'TOOL_FOLLOWUP_REFUSED',
          actions: actionResults,
        });
      }
      await releaseUsage(reservation);
      reservation = null;
      return response.status(422).json({ error: refusal });
    }

    const text = outputText(result);
    if (!text) {
      if (actionResults.length) {
        return response.status(502).json({
          error: 'A project action ran, but EYRA returned no final response.',
          code: 'TOOL_FOLLOWUP_EMPTY',
          actions: actionResults,
        });
      }
      await releaseUsage(reservation);
      reservation = null;
      return response.status(502).json({ error: 'EYRA returned an empty response.' });
    }

    let data;
    if (responseSchema) {
      try {
        data = JSON.parse(text);
      } catch {
        console.error('EYRA structured response was not valid JSON', { responseId: result.id });
        if (actionResults.length) return response.status(502).json({
          error: 'A project or Library action ran, but EYRA returned invalid final JSON.',
          code: 'TOOL_FOLLOWUP_INVALID', actions: actionResults,
        });
        await releaseUsage(reservation);
        reservation = null;
        return response.status(502).json({ error: 'EYRA returned an invalid structured response.', code: 'EYRA_SCHEMA_MISMATCH' });
      }
      if (!matchesEyraResponseSchema(data, responseSchema)) {
        console.error('EYRA structured response failed the requested schema', { responseId: result.id });
        if (actionResults.length) return response.status(502).json({
          error: 'A project or Library action ran, but EYRA returned an inconsistent final response.',
          code: 'TOOL_FOLLOWUP_INVALID', actions: actionResults,
        });
        await releaseUsage(reservation);
        reservation = null;
        return response.status(502).json({
          error: 'EYRA returned an incomplete or inconsistent structured analysis.',
          code: 'EYRA_SCHEMA_MISMATCH',
        });
      }
    }

    return response.status(200).json({
      ...(responseSchema ? { data } : {}),
      text,
      model: result.model || process.env.OPENAI_MODEL || 'gpt-5.6',
      response_id: result.id,
      plan: usage.plan,
      usage: {
        used: reservation.used,
        limit: usage.limit,
        month: usage.month,
      },
      ...(actionResults.length ? { actions: actionResults } : {}),
    });
  } catch (error) {
    await releaseUsage(reservation);
    const timedOut = error?.name === 'TimeoutError';
    // Upstream exception messages can contain private research input.
    const safeErrorClass = ['TimeoutError', 'AbortError', 'TypeError'].includes(error?.name)
      ? error.name : 'Error';
    console.error('EYRA function error', {
      type: timedOut ? 'upstream_timeout' : 'unhandled_error',
      error_class: safeErrorClass,
    });
    if (timedOut) {
      return response.status(504).json({
        error: 'EYRA timed out while contacting an external service. Please try again.',
        code: 'UPSTREAM_TIMEOUT',
      });
    }
    return response.status(500).json({ error: 'EYRA is temporarily unavailable.' });
  } finally {
    if (streamTimer) clearTimeout(streamTimer);
    response.off?.('close', stopStream);
  }
}
