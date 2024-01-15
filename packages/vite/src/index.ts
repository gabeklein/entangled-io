import { Node, Project, ts } from 'ts-morph';
import Vite from 'vite';

const DEFAULT_AGENT = require.resolve("./runtime/fetch");

interface Options {
  include?: RegExp | string;
  endpoint?: string;
  namespace?: string;
  agent?: string;
  runtimeOptions?: {}
}

function ServiceAgentPlugin(options: Options = {}): Vite.Plugin {
  const {
    agent = DEFAULT_AGENT,
    endpoint = "/api"
  } = options;

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

    // const watch = new Set<string>([resolved]);
    const sourceFile = tsProject.addSourceFileAtPath(resolved);

    tsProject.resolveSourceFileDependencies();

    let handle = "";
    const code = [] as string[];
    const exports = sourceFile.getExportedDeclarations();

    function needsEndpoint(){
      if(!handle){
        handle = "rpc";
        code.push(
          `import endpoint from "${agent}";\n`,
          `const ${handle} = endpoint("/${namespace}");\n`
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
      code: code.join("\n"),
      moduleSideEffects: false
    }
  }

  return {
    name: 'service-agent-plugin',
    enforce: 'pre',
    async resolveId(source, importer){
      if(source.startsWith("virtual:"))
        return source;

      if(source == "@example/api"){
        const namespace = "api";
        const identifier = `virtual:${namespace}`;
        const resolved = await
          this.resolve(source, importer, { skipSelf: true });

        if(resolved)
          entangled.set(identifier, {
            baseUrl: endpoint,
            resolved: resolved.id,
            namespace
          });

        return identifier;
      }

      return null;
    },
    load(id){
      if(id.startsWith("virtual:"))
        return agentModule(id);

      return null;
    },
    handleHotUpdate({ file, server }){
      debugger;
      // Handle HMR for dependencies of virtual modules
      // Trigger retransform if necessary
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