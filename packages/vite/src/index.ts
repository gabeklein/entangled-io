import { Plugin, Rollup } from 'vite';

import { Parser } from './parse';

const DEFAULT_AGENT = require.resolve("../runtime/fetch.ts");

type AsyncMaybe<T> = T | Promise<T>;

const VIRTUAL = "\0virtual:"
const AGENT_ID = VIRTUAL + "entangled-agent";

namespace Options {
  export type Test =
    (request: string, resolve: () => Promise<Rollup.ResolvedId>) =>
      AsyncMaybe<string | null | false>;
}

interface Options {
  baseUrl?: string;
  agent?: string;
  include?: Options.Test | string | RegExp;
  runtimeOptions?: {};
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
  cache = new Map<string, AgentModule>();
  modules = new Map<string, CachedModule>();

  get(id: string, reload: boolean = false): AgentModule | undefined {
    const cached = this.cache.get(id);

    if(cached && !reload)
      return cached;

    const module = this.modules.get(id);

    if(!module)
      return;

    const { path, id: resolved } = module;
    const exports = this.include(resolved, reload);
    const watch = new Set<string>([resolved]);
    const code = this.code(path, exports);

    for(const item of exports)
      if(item.type == "module")
        watch.add(item.path);

    return { code, id, watch }
  }

  code(path: string, exports: Set<Parser.ExportItem>){
    let handle = "";
    let code = ""

    for(const item of exports){
      const { name } = item;

      if(item.type == "module"){
        const mod = VIRTUAL + name;

        this.modules.set(mod, {
          id: item.path,
          path: `${path}/${name}`,
        });

        code += `export * as ${name} from "${mod}";\n`

        continue;
      }

      if(!handle){
        handle = "rpc";
        code += `import * as agent from "${AGENT_ID}";\n`
        code += `const ${handle} = agent.default("${path}");\n\n`
      }

      switch(item.type){
        case "function":
          code += item.async
            ? `export const ${name} = ${handle}("${name}");\n`
            : `export const ${name} = () => ${handle}("${name}", { async: false });\n`

        break;

        case "error":
          code += `export const ${name} = ${handle}.error("${name}");\n`
      }
    }

    return code;
  }

  set(key: string, info: CachedModule){
    this.modules.set(key, info)
  }
}

function ServiceAgentPlugin(options?: Options): Plugin {
  let {
    agent = DEFAULT_AGENT,
    baseUrl = "/",
    include,
    runtimeOptions = {}
  } = options || {};

  const agentOptions = JSON.stringify({ baseUrl, ...runtimeOptions });

  if(typeof include === "string"){
    const [expect, namespace = "api"] = include.split(":");
    include = (src) => src == expect ? namespace : null
  }
  else if(include instanceof RegExp){
    const regex = include;
    include = (src) => {
      const match = regex.exec(src);
      return match ? match[1] || "api" : null;
    };
  }

  const cache = new Map<string, AgentModule>();
  const agentModules = new AgentModules();

  return {
    name: 'entangled:client-plugin',
    enforce: 'pre',
    async resolveId(source, importer){
      if(source.startsWith(VIRTUAL))
        return source;

      let resolved: Rollup.ResolvedId | undefined;

      const resolver = () => this
        .resolve(source, importer, { skipSelf: true })
        .then(x => resolved = x);

      const name = include && await include(source, resolver);

      if(!name)
        return null;

      const identifier = VIRTUAL + name;

      if(!resolved)
        await resolver();

      if(!resolved)
        throw new Error(`Cannot resolve ${source} from ${importer}`);

      agentModules.set(identifier, {
        id: resolved.id,
        path: name
      });

      return identifier;
    },
    load(id){
      if(!id.startsWith(VIRTUAL))
        return null;
      
      if(id == AGENT_ID)
        return (
          `import * as agent from "${agent}";\n` +
          `export default agent.default(${agentOptions});`
        );

      const module = agentModules.get(id);
      
      for(const dependancy of module.watch){
        cache.set(dependancy, module);
        this.addWatchFile(dependancy);
      }

      return module;
    },
    handleHotUpdate({ file, server }){
      const module = cache.get(file);

      if(!module)
        return;

      const result = agentModules.get(module.id, true)!;

      if(module.code == result.code)
        return [];

      const { moduleGraph } = server!;
      const shouldUpdate = moduleGraph.getModuleById(module.id)!;

      cache.set(file, result);

      return [ shouldUpdate ]
    }
  };
}

export default ServiceAgentPlugin;
export { ServiceAgentPlugin };