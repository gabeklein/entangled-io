import path from 'path';
import { Project, SourceFile, ts } from 'ts-morph';
import { Compiler } from 'webpack';
import VirtualModulesPlugin from 'webpack-virtual-modules';

import CreateServicePlugin from './CreateServicePlugin';
import { uniqueHash } from './hash';
import { createManifest } from './manifest';

interface ReplacedModule {
  name: string;
  request: string;
  watch: Set<string>;
  sourceFile: SourceFile;
  location: string;
  filename: string;
}

interface RequestInfo {
  issuer: string;
  request: string;
  resolved: string;
  type: string;
}

interface Options {
  include?: RegExp | string;
  endpoint?: string;
  agent: string;
}

export default class ImportAgentPlugin {
  /** Use name of class to register hooks. */
  name = this.constructor.name;

  /** Language service used to scan imports and generate manifest. */
  tsProject: Project;

  /** Simple cache of requires tagged for replacement. */
  replacedModules = new Map<string, ReplacedModule>();

  /** Separate plugin will manage imaginary files for bundle. */
  virtualModulesPlugin: VirtualModulesPlugin;

  constructor(
    public options: Options,
    public createServicePlugin?: CreateServicePlugin){

    const tsConfigFilePath =
      ts.findConfigFile(process.cwd(), ts.sys.fileExists);

    this.tsProject = new Project({
      tsConfigFilePath,
      skipAddingFilesFromTsConfig: true
    });

    this.virtualModulesPlugin =
      new VirtualModulesPlugin();
  }

  apply(compiler: Compiler) {
    this.virtualModulesPlugin.apply(compiler);

    /*
     * As we resolve modules, if we run into one marked for 
     * override, we generate the replacement proxy implementation. 
     */
    compiler.hooks.normalModuleFactory.tap(this, (compilation) => {
      compilation.hooks.afterResolve.tap(this, (result) => {
        if(result.contextInfo.compiler == CreateServicePlugin.name)
          return;

        const target = result.createData as any;
        const resolved = target.resource;
        const useInstead = (x: string) =>
          target.resource = target.userRequest = x;

        const info = this.replacedModules.get(resolved);

        if(info){
          useInstead(info.filename);
          return;
        }

        const uid = uniqueHash(result.request, 6);
        const namespace = this.shouldInclude({
          type: target.type,
          issuer: result.contextInfo.issuer,
          request: result.request,
          resolved
        })

        if(namespace){
          if(!/\.tsx?$/.test(resolved)){
            const relative = path.relative(process.cwd(), resolved);
            throw new Error(`Tried to import ${relative} (as external) but is not typescript!`);
          }

          const mock = this.loadRemoteModule(resolved, namespace, uid);

          if(this.createServicePlugin)
            this.createServicePlugin.include(resolved, uid);

          useInstead(mock);
        }
      })
    });

    /*
     * After first compilation, we need to watch our server's source files.
     * During development, backend code might be linked;
     * we should refresh where API might change with new server logic.
     */
    compiler.hooks.afterCompile.tap(this, (compilation) => {
      // This may also be called by html-webpack-plugin but we'll want to skip that.
      // If `compilation.name` was defined by that plugin, we can bailout.
      if((compilation as any).name)
        return;

      this.replacedModules.forEach(mod => {
        mod.watch.forEach(file => {
          compilation.fileDependencies.add(file)
        })
      })
    })

    /*
     * Where files server have updated, regenerate API polyfill for compilation.
     */
    compiler.hooks.watchRun.tap(this, (compilation) => {
      const { watchFileSystem } = compilation as any;
      const watcher = watchFileSystem.watcher || watchFileSystem.wfs.watcher;
      const filesUpdated = Object.keys(watcher.mtimes || {});

      this.replacedModules.forEach(mod => {
        let updates = 0;

        for(const name of filesUpdated)
          if(mod.watch.has(name))
            updates++;

        if(updates)
          this.writeReplacement(mod);
      })
    })
  }

  /**
   * Decides if given request should be delegated to microservice.
   * If so, set namespace the resulting imports are listed under. 
   */
  shouldInclude(request: RequestInfo){
    const { request: rawRequest, resolved: resolvedRequest } = request;
    let test = this.options.include;

    if(rawRequest == test){
      const match = /^@\w\/(\w+)/.exec(test);

      if(match)
        return match[1];
    }

    if(test instanceof RegExp){
      const match =
        test.exec(rawRequest) ||
        test.exec(resolvedRequest);

      if(match)
        return (
          match[1] ||
          path.basename(resolvedRequest).replace(/\.\w+$/, "")
        )
    }

    return null;
  }

  loadRemoteModule(request: string, name: string, namespace = "default"){
    const tsc = this.tsProject;
    const sourceFile = tsc.addSourceFileAtPath(request);

    tsc.resolveSourceFileDependencies();

    const location = path.dirname(request);
    const filename = path.join(location, `${name}.proxy.js`);

    const mod: ReplacedModule = {
      name: namespace,
      request,
      location,
      sourceFile,
      filename,
      watch: new Set()
    };

    this.replacedModules.set(request, mod);
    this.writeReplacement(mod);

    return filename;
  }
  
  writeReplacement(mod: ReplacedModule){
    const { endpoint, agent } = this.options;

    const output = createManifest(mod.sourceFile, mod.watch);
    const args: {}[] = [ output ];

    const options = {
      namespace: mod.name,
      endpoint
    }

    args.push(options);

    const printArguments =
      args.map(x => JSON.stringify(x)).join(", ");

    this.virtualModulesPlugin.writeModule(mod.filename,
      `module.exports = require("${agent}")(${printArguments})`  
    );
  }
}