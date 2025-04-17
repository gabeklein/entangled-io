import { Plugin, Rollup } from 'vite';

import { AgentModule, AgentModules, CacheStrategy } from './AgentModules';

const AGENT_DEFAULT = "@entangled/vite/fetch";
const VIRTUAL = "\0virtual:entangle:";
const AGENT_ID = VIRTUAL.slice(0, -1);

type Async<T> = T | Promise<T>;

type TestFunction = (
  request: string,
  resolve: () => Promise<Rollup.ResolvedId | null>
) => Async<string | null | false>;

interface Options {
  baseUrl?: string;
  agent?: string;
  include?: TestFunction | RegExp | string;
  runtimeOptions?: Record<string, unknown>;
  cacheStrategy?: CacheStrategy;
  debug?: boolean;
  hmr?: {
    enabled?: boolean;
    strategy?: 'full-reload' | 'module-reload';
  };
}

declare namespace ServiceAgentPlugin {
  export { TestFunction, Options };
}

function ServiceAgentPlugin(options?: Options): Plugin {
  const {
    agent = AGENT_DEFAULT,
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
      if (source === AGENT_ID)
        return source;

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
      if (id == AGENT_ID)
        return (
          `import * as agent from "${agent}";\n` +
          `export default agent.default(${agentOptions});`
        );

      if (!id.startsWith(VIRTUAL))
        return null;

      try {
        const module = agentModules.get(id);

        if (!module)
          return null;

        for (const dependency of module.watch) {
          cache.set(dependency, module);
          this.addWatchFile(dependency);
        }

        let handle = "";
        let code = "";

        for (const item of module.exports) {
          const { name } = item;

          if (item.type == "module") {
            const mod = VIRTUAL + name;

            agentModules.set(mod, {
              id: item.path,
              path: `${module.path}/${name}`,
            });

            code += `export * as ${name} from "${mod}";\n`;
            continue;
          }

          if (!handle) {
            handle = "rpc";
            code += `import * as agent from "${AGENT_ID}";\n`;
            code += `const ${handle} = agent.default("${module.path}");\n\n`;
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

        if (noChange(module, result))
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

function noChange(a: AgentModule, b: AgentModule){
  if (a.exports.length !== b.exports.length || a.watch.length !== b.watch.length)
    return false;

  for (let i = 0; i < a.exports.length; i++)
    if (JSON.stringify(a.exports[i]) !== JSON.stringify(b.exports[i]))
      return false;

  for (let i = 0; i < a.watch.length; i++)
    if (a.watch[i] !== b.watch[i])
      return false;

  return true;
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