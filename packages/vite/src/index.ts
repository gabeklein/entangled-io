import { Node, Project, ts } from 'ts-morph';
import { Plugin, Rollup } from 'vite';

const DEFAULT_AGENT = require.resolve("./runtime/fetch");

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

  const tsProject = new Project({
    skipAddingFilesFromTsConfig: true,
    tsConfigFilePath: ts.findConfigFile(
      process.cwd(), ts.sys.fileExists
    )
  });

  function agentModule(id: string){
    const module = entangled.get(id);

    if(!module)
      return;

    const { namespace, resolved } = module;
    const sourceFile = tsProject.addSourceFileAtPath(resolved);
    const watch = new Set<string>([resolved]);

    tsProject.resolveSourceFileDependencies();

    let handle = "";
    const code = [] as string[];
    const exports = sourceFile.getExportedDeclarations();

    function needsEndpoint(){
      if(!handle){
        handle = "rpc";
        code.push(
          `import endpoint from "virtual:entangled-agent";\n`,
          `const ${handle} = endpoint("${namespace}");\n`
        );
      }

      return handle;
    }
  
    for(const [ key, [ value ] ] of exports){
      if(Node.isSourceFile(value)){
        const name = `${namespace}/${key}`.toLowerCase();
        const virtual = `virtual:${name}`;

        entangled.set(virtual, {
          baseUrl: module.baseUrl,
          resolved: value.getFilePath(),
          namespace: name,
        });

        code.push(`export * as ${key} from "${virtual}";`);
        continue;
      }

      if(Node.isFunctionDeclaration(value)){
        needsEndpoint();

        watch.add(value.getSourceFile().getFilePath());

        if(!value.getAsyncKeyword()){
          code.push(`export const ${key} = () => ${handle}("${key}", { async: false });`);
          continue;
        }

        code.push(`export const ${key} = ${handle}("${key}");`);
        continue;
      }

      if(isErrorType(value)){
        needsEndpoint();
        code.push(`export const ${key} = ${handle}.error("${key}");`);
      }
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
            `import agent from "${agent}";`,
            `export default agent(${JSON.stringify({
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

      const existingSourceFile = tsProject.getSourceFile(file);
  
      if(existingSourceFile)
        tsProject.removeSourceFile(existingSourceFile);

      const result = agentModule(module.id)!;

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

export function isErrorType(node: Node){
  try {
    while(Node.isClassDeclaration(node)){
      const exp = node.getExtendsOrThrow().getExpression();
      
      if(Node.isIdentifier(exp))
        node = exp.getSymbolOrThrow().getValueDeclarationOrThrow();
      else
        break;
    }

    if(Node.isVariableDeclaration(node) && 
      node.getText() == "Error:ErrorConstructor")
        return true
  }
  catch(err){}

  return false;
}

export default ServiceAgentPlugin;