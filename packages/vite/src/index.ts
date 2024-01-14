import { Project, SourceFile, ts } from 'ts-morph';
import Vite from 'vite';

import { parse } from './manifest';

const DEFAULT_AGENT = '@entangled/fetch'; // Update as per actual default agent path

interface Options {
  include?: RegExp | string;
  endpoint?: string;
  namespace?: string;
  agent?: string;
  runtimeOptions?: {}
}

interface ReplacedModule {
  name?: string;
  request?: string;
  watch: Set<string>;
  sourceFile?: SourceFile;
  location?: string;
  filename?: string;
}

function ServiceAgentPlugin(options: Options = {}): Vite.Plugin {
    const {
      agent = DEFAULT_AGENT,
      endpoint,
      runtimeOptions
    } = options;

  const replacedModules = new Map<string, ReplacedModule>();
  const tsConfigFilePath =
    ts.findConfigFile(process.cwd(), ts.sys.fileExists);
  
  const tsProject = new Project({
    skipAddingFilesFromTsConfig: true,
    tsConfigFilePath
  });

  function agentModule(resolved: string){
    const watch = new Set<string>([resolved]);
    const sourceFile = tsProject.addSourceFileAtPath(resolved);

    replacedModules.set(resolved, { watch });
    tsProject.resolveSourceFileDependencies();

    const manifest = parse(sourceFile, watch);
    const opts: any = { endpoint, ...runtimeOptions };
    const args: {}[] = [ manifest ];

    if(Object.values(opts).some(x => !!x))
      args.push(opts);

    return [
      `import * as agent from "${agent}";\n`,
      `const options = ${JSON.stringify(opts)};`,
      `const manifest = ${JSON.stringify(manifest)};\n`,
      `const stuff = agent.default(manifest, options);`,
      `export const Greetings = stuff.Greetings;`,
      `export const Errors = stuff.Errors;`,
    ].join("\n");
  }

  const entangled = new Map<string, string>();

  return {
    name: 'service-agent-plugin',
    enforce: 'pre',
    async resolveId(source, importer){
      if(source != "@example/api")
        return;

      const resolved = await
        this.resolve(source, importer, { skipSelf: true });

      const identifier = `virtual:${source}`;

      if(resolved)
        entangled.set(identifier, resolved.id);

      return identifier;
    },
    load(id){
      if(id.startsWith("virtual:")){
        const resolved = entangled.get(id);

        if(resolved){
          return {
            code: agentModule(resolved),
            // syntheticNamedExports: true,
          }
        }
      }

      return;
    },
    handleHotUpdate({ file, server }){
      // Handle HMR for dependencies of virtual modules
      // Trigger retransform if necessary
    }
  };
}

export default ServiceAgentPlugin;