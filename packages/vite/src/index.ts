import { Plugin, Rollup } from 'vite';

import { Parser } from './parse';

const DEFAULT_AGENT = require.resolve("../runtime/fetch.ts");

type AsyncMaybe<T> = T | Promise<T>;

const VIRTUAL = "\0virtual:api:";
const AGENT_ID = VIRTUAL + "entangled-agent";

export type TestFunction = (
  request: string, 
  resolve: () => Promise<Rollup.ResolvedId | null>
) => AsyncMaybe<string | null | false>;

interface Options {
  baseUrl?: string;
  agent?: string;
  include?: TestFunction | string | RegExp;
  runtimeOptions?: Record<string, unknown>;
  debug?: boolean;
  hmr?: {
    enabled?: boolean;
    strategy?: 'full-reload' | 'module-reload';
  };
  cacheStrategy?: 'aggressive' | 'conservative' | 'disabled';
}

interface AgentModule {
  id: string;
  code: string;
  watch: Set<string>;
  timestamp: number;
}

interface CachedModule {
  path: string;
  id: string;
}

class AgentModules extends Parser {
  private cache = new Map<string, AgentModule>();
  private modules = new Map<string, CachedModule>();
  private logDebug: (message: string) => void;
  private cacheStrategy: Options['cacheStrategy'];

  constructor(debugFn: (message: string) => void, cacheStrategy: Options['cacheStrategy'] = 'conservative') {
    super();
    this.logDebug = debugFn;
    this.cacheStrategy = cacheStrategy;
  }

  clear(): void {
    this.logDebug('Clearing AgentModules cache');
    this.cache.clear();
    this.modules.clear();
  }

  validateCache(id: string): boolean {
    if (this.cacheStrategy === 'disabled') return false;
    
    const cached = this.cache.get(id);
    if (!cached) return false;
    
    if (this.cacheStrategy === 'aggressive') return true;
    
    // For conservative strategy, check if watched files still exist and are valid
    try {
      for (const file of cached.watch) {
        if (!this.fileExists(file)) {
          this.logDebug(`Cache invalidated for ${id}: watched file ${file} no longer exists`);
          return false;
        }
      }
      return true;
    } catch (error) {
      this.logDebug(`Error validating cache for ${id}: ${error}`);
      return false;
    }
  }

  fileExists(path: string): boolean {
    try {
      const sourceFile = this.getSourceFile(path);
      return !!sourceFile;
    } catch {
      return false;
    }
  }

  get(id: string, reload: boolean = false): AgentModule | undefined {
    this.logDebug(`Getting module: ${id}, reload: ${reload}`);
    
    const cached = this.cache.get(id);

    if (cached && !reload && this.validateCache(id)) {
      this.logDebug(`Using cached module for ${id}`);
      return cached;
    }

    const module = this.modules.get(id);

    if (!module) {
      this.logDebug(`No module found for ${id}`);
      return;
    }

    try {
      const { path, id: resolved } = module;
      this.logDebug(`Generating code for ${id} from ${resolved}`);
      
      const exports = this.include(resolved, reload);
      const watch = new Set<string>([resolved]);
      const code = this.code(path, exports);

      for (const item of exports) {
        if (item.type == "module") {
          watch.add(item.path);
        }
      }

      const result: AgentModule = { 
        code, 
        id, 
        watch,
        timestamp: Date.now()
      };
      
      this.cache.set(id, result);
      return result;
    } catch (error) {
      this.logDebug(`Error generating module for ${id}: ${error}`);
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
    this.logDebug(`Setting module info for ${key}`);
    this.modules.set(key, info);
  }
}

function normalizeInclude(include: Options['include']): TestFunction {
  if (typeof include === "string") {
    const [expect, namespace = "api"] = include.split(":");
    return (src) => src === expect ? namespace : null;
  }
  
  if (include instanceof RegExp) {
    return (src) => {
      const match = include.exec(src);
      return match ? match[1] || "api" : null;
    };
  }
  
  return include || (() => null);
}

function ServiceAgentPlugin(options?: Options): Plugin {
  const {
    agent = DEFAULT_AGENT,
    baseUrl = "/",
    include,
    runtimeOptions = {},
    debug = false,
    hmr = { enabled: true, strategy: 'module-reload' },
    cacheStrategy = 'conservative'
  } = options || {};

  const agentOptions = JSON.stringify({ baseUrl, ...runtimeOptions });
  
  const logDebug = (message: string) => {
    if (debug) console.log(`[entangled:client-plugin] ${message}`);
  };

  const testInclude = normalizeInclude(include);
  const cache = new Map<string, AgentModule>();
  const agentModules = new AgentModules(logDebug, cacheStrategy);

  return {
    name: 'entangled:client-plugin',
    enforce: 'pre',
    
    configResolved(config) {
      logDebug(`Plugin initialized with ${config.mode} mode`);
    },
    
    async resolveId(source, importer) {
      if (source.startsWith(VIRTUAL)) {
        logDebug(`Resolved virtual module: ${source}`);
        return source;
      }

      let resolved: Rollup.ResolvedId | null = null;

      const resolver = async () => {
        try {
          resolved = await this.resolve(source, importer, { skipSelf: true });
          return resolved;
        } catch (error) {
          this.warn(`Failed to resolve ${source} from ${importer}: ${error}`);
          return null;
        }
      };

      try {
        const name = testInclude && await testInclude(source, resolver);

        if (!name) {
          logDebug(`Module ${source} does not match include pattern`);
          return null;
        }

        const identifier = VIRTUAL + name;
        logDebug(`Identified ${source} as entangled module: ${identifier}`);

        if (!resolved) {
          await resolver();
        }

        if (!resolved) {
          throw new Error(`Cannot resolve ${source} from ${importer}`);
        }

        agentModules.set(identifier, {
          id: resolved.id,
          path: name
        });

        return identifier;
      } catch (error) {
        this.error(`Error in resolveId for ${source}: ${error}`);
        return null;
      }
    },
    
    load(id) {
      if (!id.startsWith(VIRTUAL)) {
        return null;
      }
      
      logDebug(`Loading virtual module: ${id}`);
      
      if (id == AGENT_ID) {
        logDebug(`Loading agent entry point from ${agent}`);
        return (
          `import * as agent from "${agent}";\n` +
          `export default agent.default(${agentOptions});`
        );
      }

      try {
        const module = agentModules.get(id);
        
        if (!module) {
          this.warn(`Could not load module: ${id}`);
          return null;
        }
        
        for (const dependency of module.watch) {
          logDebug(`Adding watch dependency: ${dependency} for ${id}`);
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
      if (!hmr.enabled) {
        logDebug(`HMR is disabled, ignoring update for ${file}`);
        return;
      }
      
      if (hmr.strategy === 'full-reload') {
        logDebug(`Full reload strategy, restarting server for ${file}`);
        server.restart();
        return [];
      }
      
      const module = cache.get(file);

      if (!module) {
        logDebug(`No cached module for ${file}, ignoring update`);
        return;
      }

      logDebug(`HMR: Updating module ${module.id} due to file change: ${file}`);
      
      try {
        const result = agentModules.get(module.id, true);

        if (!result) {
          logDebug(`Failed to get updated module for ${module.id}`);
          return;
        }

        if (module.code === result.code) {
          logDebug(`No changes detected in ${module.id}, skipping HMR`);
          return [];
        }

        const { moduleGraph } = server;
        if (!moduleGraph) {
          logDebug(`No moduleGraph available, cannot perform HMR`);
          return;
        }
        
        const moduleToUpdate = moduleGraph.getModuleById(module.id);
        
        if (!moduleToUpdate) {
          logDebug(`Module ${module.id} not found in moduleGraph`);
          return;
        }

        cache.set(file, result);
        logDebug(`HMR: Successfully updated ${module.id}`);

        return [moduleToUpdate];
      } catch (error) {
        console.warn(`Error in HMR for ${file}: ${error}`);
        return;
      }
    },
    
    closeBundle() {
      logDebug('Closing bundle, cleaning up resources');
      agentModules.clear();
      cache.clear();
    }
  };
}

export default ServiceAgentPlugin;