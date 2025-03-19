import { Plugin, Rollup } from 'vite';

import { Parser } from './parse';

const DEFAULT_AGENT = require.resolve("../runtime/fetch.ts");

type AsyncMaybe<T> = T | Promise<T>;

const VIRTUAL = "\0virtual:entangle:";
const AGENT_ID = VIRTUAL.slice(0, -1);

export type TestFunction = (
  request: string,
  resolve: () => Promise<Rollup.ResolvedId | null>
) => AsyncMaybe<string | null | false>;

interface Options {
  baseUrl?: string;
  agent?: string;
  include?: TestFunction | string | RegExp;
  runtimeOptions?: Record<string, unknown>;
  cacheStrategy?: 'aggressive' | 'conservative' | 'disabled';
  debug?: boolean;
  hmr?: {
    enabled?: boolean;
    strategy?: 'full-reload' | 'module-reload';
  };
}

interface AgentModule {
  id: string;
  code: string;
  watch: Set<string>;
}

interface CachedModule {
  path: string;
  id: string;
}

class AgentModules extends Parser {
  private cache = new Map<string, AgentModule>();
  private modules = new Map<string, CachedModule>();
  private cacheStrategy: Options['cacheStrategy'];

  constructor(cacheStrategy: Options['cacheStrategy'] = 'conservative') {
    super();
    this.cacheStrategy = cacheStrategy;
  }

  clear(): void {
    this.cache.clear();
    this.modules.clear();
  }

  validateCache(id: string): boolean {
    if (this.cacheStrategy === 'disabled')
      return false;

    const cached = this.cache.get(id);

    if (!cached)
      return false;

    if (this.cacheStrategy === 'aggressive')
      return true;

    // For conservative strategy, check if watched files still exist and are valid
    try {
      for (const file of cached.watch)
        if (!this.fileExists(file))
          return false;

      return true;
    } catch (error) {
      return false;
    }
  }

  fileExists(path: string): boolean {
    try {
      return !!this.getSourceFile(path);
    } catch {
      return false;
    }
  }

  get(id: string, reload: boolean = false): AgentModule | undefined {
    const cached = this.cache.get(id);

    if (cached && !reload && this.validateCache(id))
      return cached;

    const module = this.modules.get(id);

    if (!module)
      return;

    try {
      const { path, id: resolved } = module;
      const exports = this.include(resolved, reload);
      const watch = new Set<string>([resolved]);
      const code = this.code(path, exports);

      for (const item of exports)
        if (item.type == "module")
          watch.add(item.path);

      const result: AgentModule = { code, id, watch };

      this.cache.set(id, result);
      return result;
    } catch (error) {
      return undefined;
    }
  }

  code(path: string, exports: Set<Parser.ExportItem>) {
    let handle = "";
    let code = "";

    for (const item of exports) {
      const { name } = item;

      if (item.type == "module") {
        const mod = VIRTUAL + name;

        this.modules.set(mod, {
          id: item.path,
          path: `${path}/${name}`,
        });

        code += `export * as ${name} from "${mod}";\n`;
        continue;
      }

      if (!handle) {
        handle = "rpc";
        code += `import * as agent from "${AGENT_ID}";\n`;
        code += `const ${handle} = agent.default("${path}");\n\n`;
      }

      switch (item.type) {
        case "function":
          code += item.async
            ? `export const ${name} = ${handle}("${name}");\n`
            : `export const ${name} = () => ${handle}("${name}", { async: false });\n`;
          break;

        case "error":
          code += `export const ${name} = ${handle}.error("${name}");\n`;
          break;
      }
    }

    return code;
  }

  set(key: string, info: CachedModule) {
    this.modules.set(key, info);
  }
}

function normalizeInclude(include: Options['include']): TestFunction {
  if (typeof include === "string") {
    const [expect, namespace = "api"] = include.split(":");
    return (src) => src === expect ? namespace : null;
  }

  if (include instanceof RegExp)
    return (src) => {
      const match = include.exec(src);
      return match ? match[1] || "api" : null;
    };

  return include || (() => null);
}

function ServiceAgentPlugin(options?: Options): Plugin {
  const {
    agent = DEFAULT_AGENT,
    baseUrl = "/",
    include,
    runtimeOptions = {},
    hmr = { enabled: true, strategy: 'module-reload' },
    cacheStrategy = 'conservative'
  } = options || {};

  const agentOptions = JSON.stringify({ baseUrl, ...runtimeOptions });
  const testInclude = normalizeInclude(include);
  const cache = new Map<string, AgentModule>();
  const agentModules = new AgentModules(cacheStrategy);

  return {
    name: 'entangled:client-plugin',
    enforce: 'pre',

    async resolveId(source, importer) {
      if (source.startsWith(VIRTUAL))
        return source;

      let resolved: Rollup.ResolvedId | null = null;

      const resolver = async () => {
        try {
          resolved = await this.resolve(source, importer, { skipSelf: true });
          return resolved;
        } catch (error) {
          console.warn(`Failed to resolve ${source} from ${importer}: ${error}`);
          return null;
        }
      };

      try {
        const name = testInclude && await testInclude(source, resolver);

        if (!name)
          return null;

        const identifier = VIRTUAL + name;

        if (!resolved)
          await resolver();

        if (!resolved)
          throw new Error(`Cannot resolve ${source} from ${importer}`);

        agentModules.set(identifier, { id: resolved.id, path: name });

        return identifier;
      } catch (error) {
        this.error(`Error in resolveId for ${source}: ${error}`);
        return null;
      }
    },

    load(id) {
      if (!id.startsWith(VIRTUAL))
        return null;

      if (id == AGENT_ID)
        return (
          `import * as agent from "${agent}";\n` +
          `export default agent.default(${agentOptions});`
        );

      try {
        const module = agentModules.get(id);

        if (!module)
          return null;

        for (const dependency of module.watch) {
          cache.set(dependency, module);
          this.addWatchFile(dependency);
        }

        return module.code;
      } catch (error) {
        this.error(`Error loading module ${id}: ${error}`);
        return null;
      }
    },

    handleHotUpdate({ file, server }) {
      if (!hmr.enabled)
        return;

      if (hmr.strategy === 'full-reload') {
        server.restart();
        return [];
      }

      const module = cache.get(file);

      if (!module)
        return;

      try {
        const result = agentModules.get(module.id, true);

        if (!result)
          return;

        if (module.code === result.code)
          return [];

        const { moduleGraph } = server;

        if (!moduleGraph)
          return;

        const moduleToUpdate = moduleGraph.getModuleById(module.id);

        if (!moduleToUpdate)
          return;

        cache.set(file, result);

        return [moduleToUpdate];
      } catch (error) {
        console.warn(`Error in HMR for ${file}: ${error}`);
        return;
      }
    },

    closeBundle() {
      agentModules.clear();
      cache.clear();
    }
  };
}

export default ServiceAgentPlugin;