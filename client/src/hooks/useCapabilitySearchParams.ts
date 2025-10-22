import { useEffect, useMemo, useRef, useState } from 'react';
import { fhirClient } from '@/lib/fhir-client';
import { useActiveServer } from '@/hooks/use-active-server';

export interface SearchParameterDef {
  name: string;
  type: string;
  documentation?: string;
  operators: string[];
  resourceType: string;
}

interface CacheEntry {
  loaded: boolean;
  error?: string;
  params: SearchParameterDef[];
}

export function useCapabilitySearchParams(resourceTypes: string[]) {
  const { activeServer } = useActiveServer();
  const cacheRef = useRef<Map<string, CacheEntry>>(new Map());
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [dataVersion, setDataVersion] = useState(0);
  const prevServerIdRef = useRef<number | null>(null);

  // Clear cache when active server changes (debounced to prevent rapid clears)
  useEffect(() => {
    if (activeServer?.id && activeServer.id !== prevServerIdRef.current) {
      // Only clear if server ID actually changed
      if (prevServerIdRef.current !== null) {
        console.log('[useCapabilitySearchParams] Server changed, clearing cache');
        cacheRef.current.clear();
        setDataVersion(v => v + 1);
      }
      prevServerIdRef.current = activeServer.id;
    }
  }, [activeServer?.id]);


  useEffect(() => {
    let cancelled = false;

    async function load() {
      setLoading(true);
      setError(null);

      try {
        const toFetch = resourceTypes.filter(rt => !cacheRef.current.get(rt)?.loaded);
        if (toFetch.length > 0) {
          const results = await Promise.allSettled(
            toFetch.map(async (rt) => {
              try {
                const params = await fhirClient.getSearchParameters(rt);
                return { rt, params };
              } catch (e: any) {
                return { rt, error: e?.message || 'Failed to load' };
              }
            })
          );

          results.forEach((r) => {
            if (r.status === 'fulfilled') {
              const { rt, params } = r.value as any;
              cacheRef.current.set(rt, { loaded: true, params: (params || []).map((p: any) => ({ ...p, resourceType: rt })) });
            } else {
              // Should not happen with our construction, but safe-guard
            }
          });

          // Capture errors separately
          results.forEach((r) => {
            if (r.status === 'fulfilled') {
              const v: any = r.value;
              if (v.error) {
                cacheRef.current.set(v.rt, { loaded: true, params: [], error: v.error });
              }
            }
          });
        }

        if (!cancelled) setDataVersion(v => v + 1);
      } catch (e: any) {
        if (!cancelled) setError(e?.message || 'Failed to load search parameters');
      } finally {
        if (!cancelled) setLoading(false);
      }
    }

    if (resourceTypes.length > 0) {
      load();
    }

    return () => {
      cancelled = true;
    };
  }, [resourceTypes.join(',')]);

  const params = useMemo(() => {
    const list: SearchParameterDef[] = [];
    resourceTypes.forEach(rt => {
      const entry = cacheRef.current.get(rt);
      if (entry?.params) list.push(...entry.params);
    });

    // De-duplicate by name+resourceType to keep context
    const seen = new Set<string>();
    const unique: SearchParameterDef[] = [];
    for (const p of list) {
      const key = `${p.resourceType}:${p.name}`;
      if (!seen.has(key)) {
        seen.add(key);
        unique.push(p);
      }
    }

    // Also provide a union set of names for convenient listing
    return unique;
  }, [dataVersion, resourceTypes.join(',')]);

  return { loading, error, params };
}
