import { getUsableSession, requireSupabase } from '@/lib/supabaseClient';
import { searchSourcePage } from '@/lib/universal-search-domain.mjs';
export { searchSourcePage } from '@/lib/universal-search-domain.mjs';

export async function searchWorkspaceSource(options) {
  const session = await getUsableSession({ required: true, validate: true });
  if (!session?.user?.id) throw Object.assign(new Error('Sign in to search your workspace.'), { code: 'AUTH_REQUIRED' });
  return searchSourcePage({
    ...options,
    rpc: (name, args, signal) => {
      let request = requireSupabase().rpc(name, args);
      if (signal && typeof request.abortSignal === 'function') request = request.abortSignal(signal);
      return request;
    },
  });
}
