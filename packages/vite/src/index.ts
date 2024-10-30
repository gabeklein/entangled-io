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
  moduleSideEffects: boolean;
}

interface CachedModule {
  namespace: string;
  resolved: string;
  // baseUrl: string;
}

class AgentModules {
  modules = new Map<string, CachedModule>();
  parser = new Parser();

  get(id: string, reload: boolean = false): AgentModule | undefined {
    const module = this.modules.get(id);

    if(!module)
      return;

    const { namespace, resolved } = module;
    const exports = this.parser.include(resolved, reload);
    const watch = new Set<string>([resolved]);

    let handle = "";
    let code = ""

    function add(inject: () => string){
      if(!handle){
        handle = "rpc";
        code += `import * as agent from "${AGENT_ID}";\n`
        code += `const ${handle} = agent.default("${namespace}");\n\n`
      }

      code += inject() + "\n";
    }

    for(const item of exports){
      const { name } = item;

      switch(item.type){
        case "module": {
          const mod = VIRTUAL + name;

          this.modules.set(mod, {
            resolved: item.path,
            namespace: `${namespace}/${name}`,
          });

          code += `export * as ${name} from "${mod}";`
        }
        break;

        case "function": {
          watch.add(name);

          add(() => item.async
            ? `export const ${name} = ${handle}("${name}");`
            : `export const ${name} = () => ${handle}("${name}", { async: false });`
          );
        }
        break;

        case "error":
          add(() => `export const ${name} = ${handle}.error("${name}");`);
        break;
      }
    }

    return {
      id,
      watch,
      code,
      moduleSideEffects: false
    }
  }

  set(key: string, info: CachedModule){
    this.modules.set(key, info)
  }
}

function ServiceAgentPlugin(options?: Options): Plugin {
  const { agent, include, agentOptions } = configure(options);

  const cache = new Map<string, AgentModule>();
  const agentModules = new AgentModules();

  const AGENT_CODE = 
    `import * as agent from "${agent}";\n` +
    `export default agent.default(${agentOptions});`

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
        resolved: resolved.id,
        namespace: name
      });

      return identifier;
    },
    load(id){
      if(!id.startsWith(VIRTUAL))
        return null;
      
      if(id == AGENT_ID)
        return AGENT_CODE;

      const module = cache.get(id) || agentModules.get(id);
      
      for(const resolved of module.watch){
        cache.set(resolved, module);
        this.addWatchFile(resolved);
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

function configure(options: Options | undefined){
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
  
  return { agent, baseUrl, include, agentOptions };
}

export default ServiceAgentPlugin;