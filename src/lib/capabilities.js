import { apiUrl } from '@/lib/api-url';
import { useEffect, useState } from 'react';

const FALLBACK_CAPABILITIES = Object.freeze({
  ai: false,
  billing: false,
  contact: false,
  scheduled_monitoring: false,
  institution_analytics: false,
});

let capabilityPromise;

export async function getCapabilities({ refresh = false } = {}) {
  if (refresh || !capabilityPromise) {
    const controller = new AbortController();
    let timeoutId;
    const timeout = new Promise((_, reject) => {
      timeoutId = setTimeout(() => {
        controller.abort();
        reject(new Error('Service availability check timed out.'));
      }, 10000);
    });
    const pending = Promise.race([
      fetch(apiUrl('/api/capabilities'), {
        headers: { accept: 'application/json' },
        cache: 'no-store',
        signal: controller.signal,
      }).then(async response => {
        if (!response.ok) throw new Error('Could not verify service availability.');
        const result = await response.json();
        return {
          ai: result.ai === true,
          billing: result.billing === true,
          contact: result.contact === true,
          scheduled_monitoring: result.scheduled_monitoring === true,
          institution_analytics: result.institution_analytics === true,
        };
      }),
      timeout,
    ]).finally(() => {
      clearTimeout(timeoutId);
    }).catch(error => {
      // An older request must not erase a newer refresh request.
      if (capabilityPromise === pending) capabilityPromise = undefined;
      throw error;
    });
    capabilityPromise = pending;
  }
  return capabilityPromise;
}

export function useCapabilities() {
  const [state, setState] = useState({
    data: FALLBACK_CAPABILITIES,
    loading: true,
    error: '',
  });

  useEffect(() => {
    let active = true;
    let retryTimer = null;
    let automaticRetryUsed = false;
    let requestVersion = 0;
    const load = async (refresh = false) => {
      const version = ++requestVersion;
      try {
        const data = await getCapabilities({ refresh });
        if (active && version === requestVersion) {
          setState({ data, loading: false, error: '' });
        }
      } catch (error) {
        if (!active || version !== requestVersion) return;
        setState({
          data: FALLBACK_CAPABILITIES,
          loading: false,
          error: error?.message || 'Service status is unavailable.',
        });
        if (!automaticRetryUsed) {
          automaticRetryUsed = true;
          retryTimer = window.setTimeout(() => {
            retryTimer = null;
            if (active) void load(true);
          }, 8000);
        }
      }
    };
    const retryWhenConnected = () => {
      if (retryTimer !== null) window.clearTimeout(retryTimer);
      retryTimer = null;
      void load(true);
    };
    const retryWhenVisible = () => {
      if (document.visibilityState === 'visible') retryWhenConnected();
    };
    void load();
    window.addEventListener('online', retryWhenConnected);
    document.addEventListener('visibilitychange', retryWhenVisible);
    return () => {
      active = false;
      if (retryTimer !== null) window.clearTimeout(retryTimer);
      window.removeEventListener('online', retryWhenConnected);
      document.removeEventListener('visibilitychange', retryWhenVisible);
    };
  }, []);

  const refresh = async () => {
    setState(current => ({ ...current, loading: true, error: '' }));
    try {
      const data = await getCapabilities({ refresh: true });
      setState({ data, loading: false, error: '' });
      return data;
    } catch (error) {
      setState({
        data: FALLBACK_CAPABILITIES,
        loading: false,
        error: error?.message || 'Service status is unavailable.',
      });
      return FALLBACK_CAPABILITIES;
    }
  };

  return { ...state, refresh };
}

export { FALLBACK_CAPABILITIES };
