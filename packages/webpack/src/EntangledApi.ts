import path from 'path';
import { Project, SourceFile, ts } from 'ts-morph';
import { Compiler } from 'webpack';
import VirtualModulesPlugin from 'webpack-virtual-modules';

import { createManifest } from './manifest';
import MicroservicePlugin from './Microservice';

interface ReplacedModule {
  name: string;
  request: string;
  watchFiles: Set<string>;
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

interface MicroserviceOptions {
  endpoint?: string;
  consumer?: string;
}

interface Options {
  include?: RegExp | string;
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
  virtualPlugin: VirtualModulesPlugin;

  /** Creates child compiler to generate corresponding services. */
  microservicePlugin: MicroservicePlugin;

  /** Language service used to scan imports, generate doppelgangers. */
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

    this.virtualPlugin =
      new VirtualModulesPlugin();
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
        if(result.contextInfo.compiler == MicroservicePlugin.name)
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

          const mock = this.loadRemoteModule(resolved, namespace);
          this.microservicePlugin.include(resolved, namespace);

          useInstead(mock);
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

      if(match){
        const name =
          match[1] ||
          path.basename(resolvedRequest).replace(/\.\w+$/, "");
  
        return name
      }
    }

    return null;
  }

  loadRemoteModule(request: string, name = "default"){
    const tsc = this.tsProject;
    const sourceFile = tsc.addSourceFileAtPath(request);

    tsc.resolveSourceFileDependencies();

    const location = path.dirname(request);
    const filename = path.join(location, `${name}.proxy.js`);

    const mod: ReplacedModule = {
      name,
      request,
      location,
      sourceFile,
      filename,
      watchFiles: new Set()
    };

    this.replacedModules.set(request, mod);
    this.writeReplacement(mod);

    return filename;
  }
  
  writeReplacement(mod: ReplacedModule){
    const output = createManifest(mod.sourceFile, mod.watchFiles);
    const data = JSON.stringify(output);

    const {
      endpoint = "http://localhost:8080",
      agent = DEFAULT_AGENT
    } = this.options;

    const options = JSON.stringify({
      namespace: mod.name,
      endpoint
    })

    this.virtualPlugin.writeModule(mod.filename,
      `module.exports = require("${agent}")(${data}, ${options})`  
    );
  }
}