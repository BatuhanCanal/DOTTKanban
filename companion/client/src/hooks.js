import { useCallback, useEffect, useState } from 'react';

import { ApiError } from './api.js';

/**
 * Veri yukleme icin kucuk yardimci: {data, error, loading, reload}.
 * Oturum duserse (401) onAuthLost cagrilir, kullanici giris ekranina doner.
 */
export function useLoader(loadFn, onAuthLost) {
  const [data, setData] = useState(null);
  const [error, setError] = useState(null);
  const [loading, setLoading] = useState(true);

  const reload = useCallback(
    async ({ silent = false } = {}) => {
      if (!silent) {
        setLoading(true);
      }

      try {
        setData(await loadFn());
        setError(null);
      } catch (caught) {
        if (caught instanceof ApiError && caught.status === 401 && onAuthLost) {
          onAuthLost();
          return;
        }

        setError(caught.message);
      } finally {
        setLoading(false);
      }
    },
    [loadFn, onAuthLost],
  );

  useEffect(() => {
    reload();
  }, [reload]);

  return { data, error, loading, reload, setData };
}
