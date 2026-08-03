const SUPABASE_URL = 'https://kbzjngpzxpniaumlupaa.supabase.co';
const MAX_PROMPT_LENGTH = 24_000;

const EYRA_INSTRUCTIONS = `You are EYRA, the research and innovation intelligence inside EYLO.

Act as a rigorous research analyst, strategic advisor, funding guide, startup co-founder, and team builder.

Rules:
- Never invent papers, researchers, institutions, grants, deadlines, statistics, or source URLs.
- Distinguish evidence from inference and clearly state uncertainty.
- If the user asks for current factual information without sources in the prompt, explain what must be verified.
- Lead with the most important insight.
- Give concise reasoning, practical next steps, and a confidence level.
- Match the user's language.
- Use clear Markdown headings and short lists.
- End with one concrete next action or a focused strategic question.`;

function outputText(response) {
  return (response.output || [])
    .flatMap(item => item.content || [])
    .filter(item => item.type === 'output_text')
    .map(item => item.text)
    .join('\n')
    .trim();
}

async function authenticate(authorization) {
  if (!authorization?.startsWith('Bearer ')) return false;
  const anonKey = process.env.VITE_SUPABASE_ANON_KEY;
  if (!anonKey) return false;

  const response = await fetch(`${SUPABASE_URL}/auth/v1/user`, {
    headers: { authorization, apikey: anonKey },
  });
  return response.ok;
}

export default async function handler(request, response) {
  if (request.method !== 'POST') {
    response.setHeader('Allow', 'POST');
    return response.status(405).json({ error: 'Method not allowed.' });
  }

  try {
    if (!(await authenticate(request.headers.authorization))) {
      return response.status(401).json({ error: 'Authentication required.' });
    }

    const apiKey = process.env.OPENAI_API_KEY;
    if (!apiKey) return response.status(503).json({ error: 'EYRA AI is not configured.' });

    const prompt = String(request.body?.prompt || '').trim().slice(0, MAX_PROMPT_LENGTH);
    if (!prompt) return response.status(400).json({ error: 'A prompt is required.' });

    const openaiResponse = await fetch('https://api.openai.com/v1/responses', {
      method: 'POST',
      headers: {
        authorization: `Bearer ${apiKey}`,
        'content-type': 'application/json',
      },
      body: JSON.stringify({
        model: process.env.OPENAI_MODEL || 'gpt-5.6-sol',
        instructions: EYRA_INSTRUCTIONS,
        input: prompt,
      }),
    });

    if (!openaiResponse.ok) {
      const requestId = openaiResponse.headers.get('x-request-id');
      console.error('OpenAI request failed', { status: openaiResponse.status, requestId });
      return response.status(502).json({ error: 'EYRA could not complete this request.' });
    }

    const result = await openaiResponse.json();
    const text = outputText(result);
    if (!text) return response.status(502).json({ error: 'EYRA returned an empty response.' });

    response.setHeader('Cache-Control', 'no-store');
    return response.status(200).json({ text, model: result.model || process.env.OPENAI_MODEL });
  } catch (error) {
    console.error('EYRA function error', { message: error instanceof Error ? error.message : 'Unknown error' });
    return response.status(500).json({ error: 'EYRA is temporarily unavailable.' });
  }
}
