import path, { resolve } from 'path';
import { Project, SourceFile, ts } from 'ts-morph';
import { Compiler, ExternalModule } from 'webpack';
import VirtualModulesPlugin from 'webpack-virtual-modules';

import { parse } from './manifest';
import { uniqueHash } from './util';

const DEFAULT_AGENT = require.resolve("@entangled/fetch");

declare namespace ServicePlugin {
  interface Module {
    name: string;
    request: string;
    watch: Set<string>;
    sourceFile: SourceFile;
    location: string;
    filename: string;
  }

  interface Options {
    include?: RegExp | string;
    endpoint?: string;
    namespace?: string;
    agent?: string;
    runtimeOptions?: {}
  }
}

class ServicePlugin {
  name = this.constructor.name;

  options: ServicePlugin.Options;

  /** Language service used to scan imports and generate manifest. */
  tsProject: Project;

  /** Separate plugin will manage imaginary files for bundle. */
  virtualModulesPlugin: VirtualModulesPlugin;

  /** Simple cache of requires tagged for replacement. */
  replaced = new Map<string, ServicePlugin.Module>();

  constructor(){
    const opts: ServicePlugin.Options = {};

    if(!opts.agent)
      opts.agent = DEFAULT_AGENT;

    if(!opts.endpoint)
      opts.endpoint = process.env.ENDPOINT;

    this.options = opts;

    const tsConfigFilePath =
      ts.findConfigFile(process.cwd(), ts.sys.fileExists);

    this.tsProject = new Project({
      tsConfigFilePath,
      skipAddingFilesFromTsConfig: true
    });

    this.virtualModulesPlugin =
      new VirtualModulesPlugin();
  }

  apply(compiler: Compiler){
    this.virtualModulesPlugin.apply(compiler);
    new NodeExternalsPlugin().apply(compiler);

    let entryFile: string;

    compiler.hooks.entryOption.tap('MyPlugin', (context, entry) => {
      const target = (entry as any).main.import.at(-1);

      entryFile = resolve(context, target);
      
      return false;
    });

    compiler.hooks.normalModuleFactory.tap(this, nmf => {
      nmf.hooks.resolve.tapAsync(this, (resolve, callback) => {
        debugger
        callback();
      })
    })

    // compiler.hooks.make.tapAsync(this, (compilation, cb) => {
    //   this.loadRemoteModule(entryFile, "main");
    // });
  }

  loadRemoteModule(request: string, name: string){
    const sourceFile =
      this.tsProject.addSourceFileAtPath(request);

    this.tsProject.resolveSourceFileDependencies();

    const location = path.dirname(request);
    const uid = uniqueHash(request, 6);
    const filename = path.join(location, `${name}.${uid}.js`);

    const mod: ServicePlugin.Module = {
      name,
      request,
      location,
      sourceFile,
      filename,
      watch: new Set()
    };

    this.replaced.set(request, mod);
    this.writeReplacement(mod);

    return filename;
  }
  
  writeReplacement(mod: ServicePlugin.Module){
    const { endpoint, agent, runtimeOptions } = this.options;
    const { name, sourceFile, watch, filename } = mod;

    const output = parse(sourceFile, watch);
    const opts: any = { endpoint, ...runtimeOptions };
    const args: {}[] = [ output ];

    if(name !== "default")
      opts.namespace = name;

    if(Object.values(opts).some(x => !!x))
      args.push(opts);

    const printArguments =
      args.map(x => JSON.stringify(x)).join(", ");

    this.virtualModulesPlugin.writeModule(filename,
      `module.exports = require("${agent}").default(${printArguments})`  
    );
  }
}

export default ServicePlugin;

class NodeExternalsPlugin {
  name = "NodeExternalsPlugin";

  apply(compiler: Compiler) {
    compiler.hooks.normalModuleFactory.tap(this, nmf => {
      nmf.hooks.resolve.tapPromise(
        {
          name: 'NodeExternalsPlugin',
          stage: 100,
        },
        async (module) => {
          const { request } = module;

          if (/node_modules/.test(module.createData.resource || ""))
            return new ExternalModule(request, "commonjs", request);

          return;
        }
      );
    });
  }
}