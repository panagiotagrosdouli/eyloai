import crypto from 'node:crypto';

const DEFAULT_SUPABASE_URL = 'https://kbzjngpzxpniaumlupaa.supabase.co';
// Supabase publishable keys are browser-safe identifiers. This is the same
// public fallback used by the web client; authorization still comes from the
// user's bearer token and database access remains protected by RLS.
const DEFAULT_SUPABASE_PUBLISHABLE_KEY = 'sb_publishable_QOF_tW8ve4IFUsflluOhww_aRubMF0V';
const MAX_PROMPT_LENGTH = 24_000;
const MAX_SCHEMA_LENGTH = 32_000;
const MAX_SCHEMA_DEPTH = 8;
const PLAN_LIMITS = { free: 5, pro: null, founder: null, institution: null };

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

  const publicKey = (
    process.env.SUPABASE_PUBLISHABLE_KEY
    || process.env.SUPABASE_ANON_KEY
    || process.env.VITE_SUPABASE_ANON_KEY
    || DEFAULT_SUPABASE_PUBLISHABLE_KEY
  ).trim();
  const supabaseUrl = (process.env.VITE_SUPABASE_URL || DEFAULT_SUPABASE_URL).replace(/\/$/, '');
  if (!publicKey) {
    console.error('EYRA auth rejected', { reason: 'missing_supabase_public_key' });
    return null;
  }

  const authResponse = await fetch(`${supabaseUrl}/auth/v1/user`, {
    headers: { authorization: bearer, apikey: publicKey },
    cache: 'no-store',
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

  return { user, entitlement, serverKey, supabaseUrl };
}

function usageState(identity) {
  const month = new Date().toISOString().slice(0, 7);
  const plan = billingActive()
    ? (PLAN_LIMITS[identity.entitlement.plan] !== undefined ? identity.entitlement.plan : 'free')
    : 'early_access';
  return {
    month,
    plan,
    used: 0,
    limit: plan === 'early_access' ? null : PLAN_LIMITS[plan],
  };
}

async function reserveUsage(identity, usage) {
  if (usage.plan === 'early_access') {
    return { allowed: true, used: 0, actionId: null };
  }

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
    await fetch(
      `${reservation.supabaseUrl}/rest/v1/rpc/release_eyra_usage`,
      {
        method: 'POST',
        headers: serverHeaders(reservation.serverKey),
        body: JSON.stringify({ p_action_id: reservation.actionId }),
      },
    );
  } catch {
    console.error('EYRA usage rollback failed.');
  }
}

export default async function handler(request, response) {
  if (request.method !== 'POST') {
    response.setHeader('Allow', 'POST');
    return response.status(405).json({ error: 'Method not allowed.' });
  }

  let reservation = null;

  try {
    const identity = await authenticate(request.headers.authorization);
    if (!identity) {
      return response.status(401).json({ error: 'Authentication required.' });
    }

    const apiKey = process.env.OPENAI_API_KEY;
    if (!apiKey) return response.status(503).json({ error: 'EYRA AI is not configured.' });

    const prompt = String(request.body?.prompt || '').trim().slice(0, MAX_PROMPT_LENGTH);
    if (!prompt) return response.status(400).json({ error: 'A prompt is required.' });

    const requestedSchema = request.body?.response_json_schema;
    let responseSchema;

    if (requestedSchema) {
      if (JSON.stringify(requestedSchema).length > MAX_SCHEMA_LENGTH) {
        return response.status(400).json({ error: 'The requested response structure is too large.' });
      }
      responseSchema = normalizeSchema(requestedSchema);
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

    const requestBody = {
      model: process.env.OPENAI_MODEL || 'gpt-5.6',
      instructions: EYRA_INSTRUCTIONS,
      input: prompt,
      store: false,
    };

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

    const openAiResponse = await fetch('https://api.openai.com/v1/responses', {
      method: 'POST',
      headers: {
        authorization: `Bearer ${apiKey}`,
        'content-type': 'application/json',
      },
      body: JSON.stringify(requestBody),
    });

    if (!openAiResponse.ok) {
      const requestId = openAiResponse.headers.get('x-request-id');
      console.error('OpenAI request failed', { status: openAiResponse.status, requestId });
      await releaseUsage(reservation);
      reservation = null;
      return response.status(502).json({ error: 'EYRA could not complete this request.' });
    }

    const result = await openAiResponse.json();
    const refusal = outputRefusal(result);
    if (refusal) {
      await releaseUsage(reservation);
      reservation = null;
      return response.status(422).json({ error: refusal });
    }

    const text = outputText(result);
    if (!text) {
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
        await releaseUsage(reservation);
        reservation = null;
        return response.status(502).json({ error: 'EYRA returned an invalid structured response.' });
      }
    }

    response.setHeader('Cache-Control', 'no-store');
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
    });
  } catch (error) {
    await releaseUsage(reservation);
    console.error('EYRA function error', {
      message: error instanceof Error ? error.message : 'Unknown error',
    });
    return response.status(500).json({ error: 'EYRA is temporarily unavailable.' });
  }
}
