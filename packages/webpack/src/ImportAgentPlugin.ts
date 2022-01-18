import path from 'path';
import { FileSystemRefreshResult, Project, SourceFile, ts } from 'ts-morph';
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
  single?: boolean;
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
    public didInlcude?: (request: string, uid: string) => void){

    if(!options.endpoint)
      options.endpoint = process.env.ENDPOINT;

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
        const { single } = this.options;

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

        const uid = single ? "default" : uniqueHash(result.request, 6);
        const name = this.shouldInclude({
          type: target.type,
          issuer: result.contextInfo.issuer,
          request: result.request,
          resolved
        })

        if(name){
          if(!/\.tsx?$/.test(resolved)){
            const relative = path.relative(process.cwd(), resolved);
            throw new Error(`Tried to import ${relative} (as external) but is not typescript!`);
          }

          const mock = this.loadRemoteModule(resolved, name, uid);

          if(this.didInlcude)
            this.didInlcude(resolved, uid);

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
      const filesUpdated = watcher.getTimes()

      this.replacedModules.forEach(mod => {
        let updates = 0;

        for(const file of mod.watch)
          if(file in filesUpdated){
            const sourceFile = 
              this.tsProject.getSourceFileOrThrow(file)
              
            if(sourceFile.refreshFromFileSystemSync() == FileSystemRefreshResult.Updated)
              updates++;
          }

        if(updates)
          this.writeReplacement(mod);
      })

      const virtual = (compiler.inputFileSystem as any)._virtualFiles;
      const fts = compiler.fileTimestamps as any;

      if (virtual && fts && typeof fts.set === 'function') {
        Object.keys(virtual).forEach((file) => {
          const mtime = virtual[file].stats.mtime;

          if(mtime)
            applyMtime(mtime);

          fts.set(file, {
            accuracy: 0,
            safeTime: mtime ? mtime + FS_ACCURACY : Infinity,
            timestamp: mtime
          });
        });
      }
    })
  }

  /**
   * Decides if given request should be delegated to microservice.
   * If so, set namespace the resulting imports are listed under. 
   */
  shouldInclude(request: RequestInfo){
    const { request: rawRequest, resolved: resolvedRequest } = request;
    let test = this.options.include;

    if(typeof test == "string"){
      if(rawRequest == test || resolvedRequest == test){
        const match = /^@(\w+)\/(\w+)/.exec(test);
  
        if(match)
          return `${match[1]}__${match[2]}`;

        return "default";
      }
    }
    else if(test instanceof RegExp){
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

  loadRemoteModule(request: string, name: string, namespace: string){
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
    const { name } = mod;

    const output = createManifest(mod.sourceFile, mod.watch);
    const options: any = { endpoint };

    const args: {}[] = [ output ];

    if(name !== "default")
      options.namespace = name;

    if(Object.values(options).some(x => !!x))
      args.push(options);

    const printArguments =
      args.map(x => JSON.stringify(x)).join(", ");

    this.virtualModulesPlugin.writeModule(mod.filename,
      `module.exports = require("${agent}")(${printArguments})`  
    );
  }
}

let FS_ACCURACY = 2000;

function applyMtime (mtime: number) {
    if (FS_ACCURACY > 1 && mtime % 2 !== 0) FS_ACCURACY = 1;
    else if (FS_ACCURACY > 10 && mtime % 20 !== 0) FS_ACCURACY = 10;
    else if (FS_ACCURACY > 100 && mtime % 200 !== 0) FS_ACCURACY = 100;
    else if (FS_ACCURACY > 1000 && mtime % 2000 !== 0) FS_ACCURACY = 1000;
};