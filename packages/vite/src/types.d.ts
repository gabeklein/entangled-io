// Shared types for ServiceAgentPlugin and AgentModules
import type { Rollup } from 'vite';

type AsyncMaybe<T> = T | Promise<T>;

export type CacheStrategy = 'disabled' | 'conservative' | 'aggressive';

export type TestFunction = (
  request: string,
  resolve: () => Promise<Rollup.ResolvedId | null>
) => AsyncMaybe<string | null | false>;

export interface Options {
  baseUrl?: string;
  agent?: string;
  include?: TestFunction | string | RegExp;
  runtimeOptions?: Record<string, unknown>;
  cacheStrategy?: CacheStrategy;
  debug?: boolean;
  hmr?: {
    enabled?: boolean;
    strategy?: 'full-reload' | 'module-reload';
  };
}