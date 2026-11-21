import { useCallback, useEffect, useState } from 'react';
import type { Repositories } from '@/db';
import { useAppStore } from '@/state/appStore';

export type AsyncState<T> = {
  data: T | null;
  loading: boolean;
  error: string | null;
  reload: () => void;
};

/** Minimal data hook: no cache library, no background magic, explicit reload. */
export function useAsyncData<T>(loader: (repos: Repositories) => Promise<T>, deps: unknown[] = []): AsyncState<T> {
  const repos = useAppStore((state) => state.repos);
  const [data, setData] = useState<T | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [nonce, setNonce] = useState(0);

  useEffect(() => {
    let cancelled = false;
    if (!repos) return;
    setLoading(true);
    loader(repos)
      .then((result) => {
        if (cancelled) return;
        setData(result);
        setError(null);
      })
      .catch((cause: unknown) => {
        if (cancelled) return;
        setError(cause instanceof Error ? cause.message : 'Erreur inconnue');
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });
    return () => {
      cancelled = true;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [repos, nonce, ...deps]);

  const reload = useCallback(() => setNonce((value) => value + 1), []);
  return { data, loading, error, reload };
}
