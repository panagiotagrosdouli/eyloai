import { createClient } from '@base44/sdk';
import { appParams } from '@/lib/app-params';

if (!appParams.appId) {
  console.warn(
    '[base44] VITE_BASE44_APP_ID is not configured. The application can build, but Base44 API calls require an app ID.',
  );
}

export const base44 = createClient({
  appId: appParams.appId,
  token: appParams.token || undefined,
  baseURL: appParams.appBaseUrl || undefined,
  functionsVersion: appParams.functionsVersion || undefined,
});

export default base44;
