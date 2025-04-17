import { Plugin, Rollup } from 'vite';
import { AgentModule, AgentModules } from './AgentModules';
import { Options, TestFunction } from './types';

const DEFAULT_AGENT = require.resolve("../runtime/fetch.ts");

const VIRTUAL = "\0virtual:entangle:";
const AGENT_ID = VIRTUAL.slice(0, -1);

function ServiceAgentPlugin(options?: Options): Plugin {
  const {
    agent = DEFAULT_AGENT,
    baseUrl = "/",
    include,
    runtimeOptions = {},
    hmr = { enabled: true, strategy: 'module-reload' },
    cacheStrategy = 'conservative'
  } = options || {};

  const agentModules = new AgentModules(cacheStrategy);
  const agentOptions = JSON.stringify({ baseUrl, ...runtimeOptions });
  const testInclude = normalizeInclude(include);
  const cache = new Map<string, AgentModule>();

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
        const name = await testInclude(source, resolver);

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

function normalizeInclude(include: Options['include']): TestFunction | undefined {
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

export { ServiceAgentPlugin };