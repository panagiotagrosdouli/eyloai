import { supabaseEntities, supabaseProfile } from '@/services/supabase-entities';
import { invokeEyra } from '@/lib/eyra-intelligence';

// Compatibility facade: existing pages keep their stable API while persistence
// moves from Base44 entities to Supabase PostgreSQL with per-user RLS.
export const base44 = {
  // Do not spread the SDK client here. It exposes `asServiceRole` as a
  // getter, and reading it during module initialization throws in the browser
  // when no Base44 service token is configured.
  auth: {
    me: supabaseProfile.me.bind(supabaseProfile),
    updateMe: supabaseProfile.updateMe.bind(supabaseProfile),
  },
  entities: supabaseEntities,
  integrations: { Core: { InvokeLLM: invokeEyra } },
};

export default base44;
