/**
 * Client-side Server Scoping Utilities
 * 
 * Provides consistent server scoping for React Query keys and localStorage
 * to ensure data isolation between different FHIR servers.
 */

import { useActiveServer } from '../hooks/use-active-server';

/**
 * Get server-scoped query key for React Query
 */
export function getServerScopedQueryKey(baseKey: string[], serverId?: number): string[] {
  if (serverId) {
    return [...baseKey, `server:${serverId}`];
  }
  return baseKey;
}

/**
 * Get server-scoped storage key for localStorage
 */
export function getServerScopedStorageKey(baseKey: string, serverId?: number): string {
  if (serverId) {
    return `${baseKey}-server-${serverId}`;
  }
  return baseKey;
}

/**
 * Hook to get server-scoped query key
 */
export function useServerScopedQueryKey(baseKey: string[]) {
  const { activeServer } = useActiveServer();
  return getServerScopedQueryKey(baseKey, activeServer?.id);
}

/**
 * Hook to get server-scoped storage key
 */
export function useServerScopedStorageKey(baseKey: string) {
  const { activeServer } = useActiveServer();
  return getServerScopedStorageKey(baseKey, activeServer?.id);
}

/**
 * Common query keys with server scoping
 */
export const ServerScopedQueryKeys = {
  validationSettings: (serverId?: number) => getServerScopedQueryKey(['validation-settings'], serverId),
  validationProgress: (serverId?: number) => getServerScopedQueryKey(['validation-progress'], serverId),
  validationStats: (serverId?: number) => getServerScopedQueryKey(['validation-stats'], serverId),
  dashboardStats: (serverId?: number) => getServerScopedQueryKey(['dashboard-stats'], serverId),
  fhirResources: (serverId?: number) => getServerScopedQueryKey(['fhir-resources'], serverId),
  validationErrors: (serverId?: number) => getServerScopedQueryKey(['validation-errors'], serverId),
  validationGroups: (serverId?: number) => getServerScopedQueryKey(['validation-groups'], serverId),
} as const;

/**
 * Common storage keys with server scoping
 */
export const ServerScopedStorageKeys = {
  validationProgress: (serverId?: number) => getServerScopedStorageKey('validation-progress', serverId),
  validationSettings: (serverId?: number) => getServerScopedStorageKey('validation-settings', serverId),
  userPreferences: (serverId?: number) => getServerScopedStorageKey('user-preferences', serverId),
} as const;

