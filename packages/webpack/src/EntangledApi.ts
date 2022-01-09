import path from 'path';
import { Project, SourceFile, ts } from 'ts-morph';
import { Compiler } from 'webpack';
import VirtualModulesPlugin from 'webpack-virtual-modules';

import { createManifest } from './manifest';
import MicroservicePlugin from './Microservice';

interface ReplacedModule {
  name: string;
  watchFiles: Set<string>;
  sourceFile: SourceFile;
  location: string;
  filename: string;
}

interface RequestInfo {
  requiredBy: string;
  rawRequest: string;
  resolvedRequest: string;
  type: string;
}

interface MicroserviceOptions {
  endpoint?: string;
  consumer?: string;
}

interface Options {
  include?: RegExp;
  options?: (request: RequestInfo) => MicroserviceOptions;
  endpoint?: string;
  agent?: string;
  runtime?: string;
  namespace?: string;
}

/**
 * Default service-agent comes included with this plugin.
 * We get webpack to include it by resolving from here.
 * This way, it doesn't need to be a peer-dependency.
 */
const DEFAULT_AGENT = require.resolve("@entangled/fetch");

export default class ApiReplacementPlugin {
  /** Use name of class to register hooks. */
  name = this.constructor.name;

  /** Simple cache of requires tagged for replacement. */
  replacedModules = new Map<string, ReplacedModule>();

  /** Separate plugin will manage imaginary files for bundle. */
  virtualPlugin = new VirtualModulesPlugin();

  microservicePlugin: MicroservicePlugin;

  agent = DEFAULT_AGENT;

  tsProject: Project;

  constructor(public options: Options = {}){
    const tsConfigFilePath =
      ts.findConfigFile(process.cwd(), ts.sys.fileExists);

    this.tsProject = new Project({
      tsConfigFilePath,
      skipAddingFilesFromTsConfig: true
    });

    this.microservicePlugin =
      new MicroservicePlugin(options);
  }

  apply(compiler: Compiler) {
    this.virtualPlugin.apply(compiler);
    this.microservicePlugin.apply(compiler);

    this.applyAfterResolve(compiler);
    this.applyAfterCompile(compiler);
    this.applyWatchRun(compiler);
  }

  /**
   * As we resolve modules, if we run into one marked for 
   * override, we generate the replacement proxy implementation. 
   */
  applyAfterResolve(compiler: Compiler){
    compiler.hooks.normalModuleFactory.tap(this, (compilation) => {
      compilation.hooks.afterResolve.tap(this, (result) => {
        const { include } = this.options;
        const resolved = result.createData as any;
        const resource = resolved.resource;

        const info = this.replacedModules.get(resource);

        if(info){
          resolved.resource = resolved.userRequest = info.filename;
          return;
        }

        const apply = (namespace: string) => {
          if(!/\.tsx?$/.test(resource)){
            const relative = path.relative(process.cwd(), resource);
            throw new Error(`Tried to import ${relative} (as external) but is not typescript!`);
          }

          resolved.resource =
          resolved.userRequest =
            this.loadRemoteModule(resource, namespace);
        }

        if(typeof include == "function"){
          // const info: RequestInfo = {
          //   requiredBy: result.contextInfo.issuer,
          //   rawRequest: result.request,
          //   resolvedRequest: resolved.resource,
          //   type: resolved.type
          // }
        }

        else if(include instanceof RegExp){
          const match = include.exec(resource);

          if(match){
            const name =
              match[1] ||
              path.basename(resource.replace(/\.\w+$/, ""));

            apply(name);
          }
        }
      })
    });
  }

  /**
   * After first compilation, we need to watch our server's source files.
   * During development, backend code might be linked;
   * we should refresh where API might change with new server logic.
   */
  applyAfterCompile(compiler: Compiler){
    compiler.hooks.afterCompile.tap(this, (compilation) => {
      // This may also be called by html-webpack-plugin but we'll want to skip that.
      // If `compilation.name` was defined by that plugin, we can bailout.
      if((compilation as any).name)
        return;

      this.replacedModules.forEach(mod => {
        mod.watchFiles.forEach(file => {
          compilation.fileDependencies.add(file)
        })
      })
    })
  }

  /**
   * Where files server have updated, regenerate API polyfill for compilation.
   */
  applyWatchRun(compiler: Compiler){
    compiler.hooks.watchRun.tap(this, (compilation) => {
      const { watchFileSystem } = compilation as any;
      const watcher = watchFileSystem.watcher || watchFileSystem.wfs.watcher;
      const filesUpdated = Object.keys(watcher.mtimes || {});

      this.replacedModules.forEach(mod => {
        let updates = 0;

        for(const name of filesUpdated)
          if(mod.watchFiles.has(name))
            updates++;

        if(updates)
          this.writeReplacement(mod);
      })
    })
  }

  loadRemoteModule(file: string, name?: string){
    const tsc = this.tsProject;
    const sourceFile = tsc.addSourceFileAtPath(file);

    tsc.resolveSourceFileDependencies();

    const location = path.dirname(file);
    const filename = path.join(location, `${name}.proxy.js`);

    const mod: ReplacedModule = {
      name: file,
      location,
      sourceFile,
      watchFiles: new Set(),
      filename
    };

    this.replacedModules.set(file, mod);
    this.writeReplacement(mod);

    return filename;
  }
  
  writeReplacement(mod: ReplacedModule){
    const output = createManifest(mod.sourceFile, mod.watchFiles);
    let endpoint = "http://localhost:8080";

    const data = JSON.stringify(output);

    if(/^[/A-Z]+$/.test(endpoint))
      endpoint = `process.env.${endpoint}`;

    const content =
      `module.exports = require("${this.agent}")(${data}, "${endpoint}")`;

    this.virtualPlugin.writeModule(mod.filename, content);
  }
}