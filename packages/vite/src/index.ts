import { Plugin, Rollup } from 'vite';

import { Parser } from './parse';

const DEFAULT_AGENT = require.resolve("../runtime/fetch.ts");

type AsyncMaybe<T> = T | Promise<T>;

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

function ServiceAgentPlugin(options?: Options): Plugin {
  const { agent, baseUrl, include, agentOptions } = configure(options);

  const cache = new Map<string, {
    id: string;
    code: string;
    watch: Set<string>;
    moduleSideEffects: boolean;
  }>();

  const entangled = new Map<string, {
    namespace: string;
    resolved: string;
    baseUrl: string;
  }>();

  const parser = new Parser();

  function agentModule(id: string, reload: boolean = false){
    const module = entangled.get(id);

    if(!module)
      return;

    const { namespace, resolved } = module;
    const watch = new Set<string>([resolved]);
    const items = parser.include(resolved, reload);

    let handle = "";
    let code = ""

    function inject(name: string, inject: () => string){
      if(!handle){
        handle = "rpc";
        code +=
          `import * as agent from "virtual:entangled-agent";\n` +
          `const ${handle} = agent.default("${namespace}");\n\n`
      }

      code += `export const ${name} = ${inject()}\n`;
    }

    for(const item of items){
      const { name } = item;

      switch(item.type){
        case "module": {
          const mod = `virtual:${name}`;
          const path = `${namespace}/${name}`.toLowerCase();

          entangled.set(mod, {
            baseUrl: module.baseUrl,
            resolved: item.path,
            namespace: path,
          });

          code += `export * as ${name} from "${mod}";`
        }
        break;

        case "function": {
          watch.add(name);

          if(!item.async)
            inject(name, () => `() => ${handle}("${name}", { async: false });`);
          else
            inject(name, () => `${handle}("${name}");`);
        }
        break;

        case "error":
          inject(name, () => `${handle}.error("${name}");`);
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

  return {
    name: 'entangled:client-plugin',
    enforce: 'pre',
    async resolveId(source, importer){
      if(source.startsWith("virtual:"))
        return source;

      let resolved: Rollup.ResolvedId | undefined;

      const resolver = () => this
        .resolve(source, importer, { skipSelf: true })
        .then(x => resolved = x);

      const name = include && await include(source, resolver);

      if(!name)
        return null;

      const identifier = `virtual:${name}`;

      if(!resolved)
        await resolver();

      if(!resolved)
        throw new Error(`Cannot resolve ${source} from ${importer}`);

      entangled.set(identifier, {
        baseUrl,
        resolved: resolved.id,
        namespace: name
      });

      return identifier;
    },
    load(id){
      if(id.startsWith("virtual:")){
        if(id == "virtual:entangled-agent")
          return [
            `import * as agent from "${agent}";`,
            `export default agent.default(${agentOptions});`
          ].join("\n");

        const module = cache.get(id) || agentModule(id);
        
        for(const resolved of module.watch){
          cache.set(resolved, module);
          this.addWatchFile(resolved);
        }

        return module;
      }

      return null;
    },
    handleHotUpdate({ file, server }){
      const module = cache.get(file);

      if(!module)
        return;

      const result = agentModule(module.id, true)!;

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