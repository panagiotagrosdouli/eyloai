import { createClient } from '@base44/sdk';
import { appParams } from '@/lib/app-params';
import { supabaseEntities, supabaseProfile } from '@/services/supabase-entities';

if (!appParams.appId) {
  console.warn(
    '[base44] VITE_BASE44_APP_ID is not configured. The application can build, but Base44 API calls require an app ID.',
  );
}

const legacyClient = createClient({
  appId: appParams.appId,
  token: appParams.token || undefined,
  baseURL: appParams.appBaseUrl || undefined,
  functionsVersion: appParams.functionsVersion || undefined,
});

// Compatibility facade: existing pages keep their stable API while persistence
// moves from Base44 entities to Supabase PostgreSQL with per-user RLS.
export const base44 = {
  ...legacyClient,
  auth: { ...legacyClient.auth, me: supabaseProfile.me.bind(supabaseProfile), updateMe: supabaseProfile.updateMe.bind(supabaseProfile) },
  entities: supabaseEntities,
  integrations: legacyClient.integrations,
};

export default base44;
