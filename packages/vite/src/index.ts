import Vite from 'vite';
import path from 'path';
import { Project, FileSystemRefreshResult, SourceFile, ts } from 'ts-morph';
import { parse } from './manifest'; // Assuming similar utility as in Webpack plugin

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

function ServiceAgentPlugin(options: Options): Vite.Plugin {
    const {
      agent = DEFAULT_AGENT,
      endpoint,
      runtimeOptions
    } = options;

  const replacedModules = new Map<string, ReplacedModule>();
  const tsConfigFilePath = ts.findConfigFile(
    process.cwd(), ts.sys.fileExists);
  
  const tsProject = new Project({
    skipAddingFilesFromTsConfig: true,
    tsConfigFilePath
  });

  function agentModule(name: string, request: string, resolved: string){
    const watch = new Set<string>([resolved]);
    const sourceFile = tsProject.addSourceFileAtPath(resolved);

    replacedModules.set(resolved, { watch });
    tsProject.resolveSourceFileDependencies();

    // this will analyze the source file using typescript.
    // A JSON representation of the module's exports is returned.
    const manifest = parse(sourceFile, watch);
    const opts: any = { endpoint, ...runtimeOptions };
    const args: {}[] = [ manifest ];

    if(name !== "default")
      opts.namespace = name;

    if(Object.values(opts).some(x => !!x))
      args.push(opts);

    return [
      `const { default: createProxy } = require("${agent}");`,
      `const manifest = ${JSON.stringify(manifest)};`,
      `const options = ${JSON.stringify(opts)};`,
      `module.exports = createProxy(manifest, options);`
    ].join("\n");
  }

  return {
    name: 'ServiceAgentPlugin',
    resolveId(source){
      if(true)
        return null;

      return `virtual:${source}`;
    },
    load(id){
      if(!id.startsWith('virtual:'))
        return null;
    },
    handleHotUpdate({ file, server }){
      // Handle HMR for dependencies of virtual modules
      // Trigger retransform if necessary
    }
  };
}

export default ServiceAgentPlugin;