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

function ServiceAgentPlugin(options: Options = {}): Plugin {
  let {
    agent = DEFAULT_AGENT,
    baseUrl = "/",
    include,
    runtimeOptions = {}
  } = options;

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
    const code = [] as string[];

    function needsEndpoint(){
      if(!handle){
        handle = "rpc";
        code.push(
          `import * as agent from "virtual:entangled-agent";\n`,
          `const ${handle} = agent.default("${namespace}");\n`
        );
      }

      return handle;
    }

    for(const item of items)
      switch(item.type){
        case "module":
          const name = `${namespace}/${item.name}`.toLowerCase();
          const virtual = `virtual:${name}`;

          entangled.set(virtual, {
            baseUrl: module.baseUrl,
            resolved: item.path,
            namespace: name,
          });

          code.push(`export * as ${item.name} from "${virtual}";`);
        break;

        case "function":
          needsEndpoint();

          watch.add(item.name);

          if(!item.async){
            code.push(`export const ${item.name} = () => ${handle}("${item.name}", { async: false });`);
            continue;
          }

          code.push(`export const ${item.name} = ${handle}("${item.name}");`);
        break;

        case "error":
          needsEndpoint();
          code.push(`export const ${item.name} = ${handle}.error("${item.name}");`);
        break;
      }

    return {
      id,
      watch,
      code: code.join("\n"),
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
        .then(x => resolved = x!);

      if(typeof include === "string"){
        const [expect, namespace = "api"] = include.split(":");
        include = (source) => {
          return source == expect ? namespace : null;
        };
      }
      else if(include instanceof RegExp){
        const regex = include;
        include = (source) => {
          const match = regex.exec(source);
          return match ? match[1] || "api" : null;
        };
      }

      const name = include && await include(source, resolver);

      if(name){
        const namespace = typeof name === "string" ? name : "";
        const identifier = `virtual:${namespace}`;

        if(!resolved)
          await resolver();

        if(!resolved)
          throw new Error(`Cannot resolve ${source} from ${importer}`);

        entangled.set(identifier, {
          baseUrl,
          resolved: resolved.id,
          namespace
        });

        return identifier;
      }

      return null;
    },
    load(id){
      if(id.startsWith("virtual:")){
        if(id == "virtual:entangled-agent")
          return [
            `import * as agent from "${agent}";`,
            `export default agent.default(${JSON.stringify({
              baseUrl, ...runtimeOptions
            })});`
          ].join("\n");

        const module = cache.get(id) || agentModule(id)!;
        
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

      return [
        shouldUpdate
      ]
    }
  };
}

export default ServiceAgentPlugin;