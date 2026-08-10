import { supabase } from '@/lib/supabaseClient';

export class FundingRequestError extends Error {
  constructor(message, status) {
    super(message);
    this.name = 'FundingRequestError';
    this.status = status;
  }
}

export async function searchFundingOpportunities(query, limit = 12) {
  const cleanQuery = String(query || '').trim();
  if (!cleanQuery) throw new FundingRequestError('Describe the funding you want to find.', 400);

  const { data, error: sessionError } = await supabase.auth.getSession();
  if (sessionError) throw sessionError;

  const accessToken = data.session?.access_token;
  if (!accessToken) throw new FundingRequestError('Sign in to search official funding sources.', 401);

  const params = new URLSearchParams({
    q: cleanQuery,
    limit: String(Math.min(15, Math.max(1, Number(limit) || 12))),
  });

  const response = await fetch(`/api/opportunities?${params}`, {
    headers: { authorization: `Bearer ${accessToken}` },
  });
  const result = await response.json().catch(() => ({}));

  if (!response.ok) {
    throw new FundingRequestError(
      result.error || 'The official funding search did not complete.',
      response.status,
    );
  }

  return {
    ...result,
    items: Array.isArray(result.items) ? result.items : [],
  };
}
