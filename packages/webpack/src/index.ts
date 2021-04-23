import { Compiler } from 'webpack';

import { generatePolyfill } from './generate';
import { resolveTypes } from './resolve';
import VirtualModulesPlugin from './virtual-modules-plugin';

/**
 * Default service-agent comes included with this plugin.
 * We get webpack to include it by resolving from here.
 * This way, it doesn't need to be a peer-dependency.
 */
const DEFAULT_AGENT = require.resolve("@entangled/fetch");

export interface ReplacedModule {
  location?: string
  filename?: string
  watchFiles: Set<string>
};

export interface Options {
  endpoint?: string;
  agent?: string;
}

class ApiReplacementPlugin {
  /** Use name of class to register hooks. */
  name = this.constructor.name;

  /** Name of module client will use to consume service. */
  agent: string;

  /** List of modules this plugin should replace with SA. */
  replaceModules: string[];

  /** Simple cache of requires tagged for replacement. */
  replacedModules = new Map<string, ReplacedModule>();

  /** Seperate plugin will manage imaginary files for bundle. */
  virtualPlugin = new VirtualModulesPlugin();

  /**
   * @param modules - List of modules we want to "polyfill" on the client.
   * @param opts
   */
  constructor(modules: string[], opts: Options = {}){
    this.agent = opts.agent || DEFAULT_AGENT;
    this.replaceModules = modules;
  }

  apply(compiler: Compiler) {
    this.virtualPlugin.apply(compiler);
    this.applyEntryOption(compiler);
    this.applyBeforeResolve(compiler);
    this.applyPostCompile(compiler);
    this.applyWatchRun(compiler);
  }

  /**
   * After context is established by webpack, scan for the declared modules we will shim.
   * Here we resolve typings and hold them for the schema generator.
   */
  applyEntryOption(compiler: Compiler){
    compiler.hooks.entryOption.tap(this.name, (context) => {
      this.replaceModules.forEach(request => {
        const location = resolveTypes(context, request);

        this.replacedModules.set(request, {
          location,
          watchFiles: new Set()
        });
      })
    })
  }

  /**
   * As we resolve modules, if we run into one marked for 
   * override, we generate the replacement proxy implementation. 
   */
  applyBeforeResolve(compiler: Compiler){
    compiler.hooks.normalModuleFactory.tap(this.name, (compilation: any) => {
      compilation.hooks.beforeResolve.tap(this.name, (result: any) => {
        const { request } = result;

        const module = this.replacedModules.get(request);

        if(!module)
          return;

        if(!module.filename)
          this.writeReplacement(module);

        result.request = module.filename;
      })
    });
  }

  /**
   * After first compilation, we need to watch our server's source files.
   * During development, backend code might be linked;
   * we should refresh where API might change with new server logic.
   */
  applyPostCompile(compiler: Compiler){
    compiler.hooks.afterCompile.tap(this.name, (compilation) => {
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
    compiler.hooks.watchRun.tap(this.name, (compilation) => {
      const { watchFileSystem } = compilation as any;
      const watcher = watchFileSystem.watcher || watchFileSystem.wfs.watcher;
      const filesUpdated = Object.keys(watcher.mtimes);

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
  
  writeReplacement(target: ReplacedModule){
    const { file, content, source } =
      generatePolyfill(target.location!, this.agent);

    this.virtualPlugin.writeModule(file, content);
    source.forEach(x => target.watchFiles.add(x.file));
    target.filename = file;
  }
}

module.exports = ApiReplacementPlugin;