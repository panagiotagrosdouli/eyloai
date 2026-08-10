const DEFAULT_SUPABASE_URL = 'https://kbzjngpzxpniaumlupaa.supabase.co';
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
- Give concise reasoning, practical next steps, and a confidence level.
- Match the user's language.
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

async function authenticate(authorization) {
  if (!authorization?.startsWith('Bearer ')) return null;
  const anonKey = process.env.VITE_SUPABASE_ANON_KEY;
  const supabaseUrl = process.env.VITE_SUPABASE_URL || DEFAULT_SUPABASE_URL;
  if (!anonKey) return null;

  const authResponse = await fetch(`${supabaseUrl}/auth/v1/user`, {
    headers: { authorization, apikey: anonKey },
  });
  if (!authResponse.ok) return null;
  const user = await authResponse.json();

  const profileResponse = await fetch(
    `${supabaseUrl}/rest/v1/profiles?user_id=eq.${encodeURIComponent(user.id)}&select=data&limit=1`,
    { headers: { authorization, apikey: anonKey } },
  );
  const rows = profileResponse.ok ? await profileResponse.json() : [];
  return {
    user,
    profileData: rows?.[0]?.data || {},
    authorization,
    anonKey,
    supabaseUrl,
  };
}

function usageState(identity) {
  const month = new Date().toISOString().slice(0, 7);
  const plan = PLAN_LIMITS[identity.profileData.subscription_tier] !== undefined
    ? identity.profileData.subscription_tier
    : 'free';
  const sameMonth = identity.profileData.eyra_usage_month === month;
  const used = sameMonth ? Number(identity.profileData.eyra_usage_count || 0) : 0;
  return { month, plan, used, limit: PLAN_LIMITS[plan] };
}

async function recordUsage(identity, usage) {
  const data = {
    ...identity.profileData,
    eyra_usage_month: usage.month,
    eyra_usage_count: usage.used + 1,
  };
  const result = await fetch(`${identity.supabaseUrl}/rest/v1/profiles?on_conflict=user_id`, {
    method: 'POST',
    headers: {
      authorization: identity.authorization,
      apikey: identity.anonKey,
      'content-type': 'application/json',
      Prefer: 'resolution=merge-duplicates,return=minimal',
    },
    body: JSON.stringify({ user_id: identity.user.id, data }),
  });
  if (!result.ok) throw new Error(`Usage persistence failed: ${result.status}`);
}

export default async function handler(request, response) {
  if (request.method !== 'POST') {
    response.setHeader('Allow', 'POST');
    return response.status(405).json({ error: 'Method not allowed.' });
  }

  try {
    const identity = await authenticate(request.headers.authorization);
    if (!identity) {
      return response.status(401).json({ error: 'Authentication required.' });
    }

    const usage = usageState(identity);
    if (usage.limit !== null && usage.used >= usage.limit) {
      return response.status(429).json({
        error: `The free plan includes ${usage.limit} EYRA AI actions per month. Upgrade to continue.`,
        code: 'PLAN_LIMIT_REACHED',
        plan: usage.plan,
        usage: { used: usage.used, limit: usage.limit, month: usage.month },
        upgrade_url: '/pricing',
      });
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
      return response.status(502).json({ error: 'EYRA could not complete this request.' });
    }

    const result = await openAiResponse.json();
    const refusal = outputRefusal(result);
    if (refusal) return response.status(422).json({ error: refusal });

    const text = outputText(result);
    if (!text) return response.status(502).json({ error: 'EYRA returned an empty response.' });

    let data;
    if (responseSchema) {
      try {
        data = JSON.parse(text);
      } catch {
        console.error('EYRA structured response was not valid JSON', { responseId: result.id });
        return response.status(502).json({ error: 'EYRA returned an invalid structured response.' });
      }
    }

    try {
      await recordUsage(identity, usage);
    } catch (usageError) {
      console.error('EYRA usage tracking failed', {
        message: usageError instanceof Error ? usageError.message : 'Unknown error',
        userId: identity.user.id,
      });
    }

    response.setHeader('Cache-Control', 'no-store');
    return response.status(200).json({
      ...(responseSchema ? { data } : {}),
      text,
      model: result.model || process.env.OPENAI_MODEL || 'gpt-5.6',
      response_id: result.id,
      plan: usage.plan,
      usage: {
        used: usage.used + 1,
        limit: usage.limit,
        month: usage.month,
      },
    });
  } catch (error) {
    console.error('EYRA function error', {
      message: error instanceof Error ? error.message : 'Unknown error',
    });
    return response.status(500).json({ error: 'EYRA is temporarily unavailable.' });
  }
}
