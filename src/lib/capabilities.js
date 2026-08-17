import { useEffect, useState } from 'react';

const FALLBACK_CAPABILITIES = Object.freeze({
  ai: false,
  billing: false,
  scheduled_monitoring: false,
  institution_analytics: false,
});

let capabilityPromise;

export async function getCapabilities({ refresh = false } = {}) {
  if (refresh || !capabilityPromise) {
    capabilityPromise = fetch('/api/capabilities', {
      headers: { accept: 'application/json' },
      cache: 'no-store',
    }).then(async response => {
      if (!response.ok) throw new Error('Could not verify service availability.');
      const result = await response.json();
      return {
        ai: result.ai === true,
        billing: result.billing === true,
        scheduled_monitoring: result.scheduled_monitoring === true,
        institution_analytics: result.institution_analytics === true,
      };
    }).catch(error => {
      capabilityPromise = undefined;
      throw error;
    });
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
    getCapabilities().then(data => {
      if (active) setState({ data, loading: false, error: '' });
    }).catch(error => {
      if (active) {
        setState({
          data: FALLBACK_CAPABILITIES,
          loading: false,
          error: error?.message || 'Service status is unavailable.',
        });
      }
    });
    return () => { active = false; };
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
