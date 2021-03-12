import { Compiler } from 'webpack';

import { generatePolyfill } from './generate';
import { resolveTypes } from './resolve';
import VirtualModulesPlugin from './virtual-modules-plugin';

const DEFAULT_AGENT = "@entangled/fetch";

export interface RemoteModule {
  location?: string
  filename?: string
  files: Set<string>
};

export interface Options {
  endpoint?: string;
  agent?: string;
}

function ensureModule(request: string){
  const match = /^((?:@\w+\/)?\w+)/.exec(request);
  return match && request;
}

class ApiReplacementPlugin {
  /** Use name of class to register hooks. */
  name = this.constructor.name;

  agent = DEFAULT_AGENT;

  /** Simple cache of requires tagged for replacement. */
  remoteModules = new Map<string, RemoteModule>();

  /** Seperate plugin will manage imaginary files for bundle. */
  virtualPlugin = new VirtualModulesPlugin();

  /** Consume list of modules we want to "polyfill" on the client. */
  constructor(
    private modules: string[] = [],
    opts: Options = {}
  ){
    if(opts.agent)
      this.agent = opts.agent;
  }

  apply(compiler: Compiler) {
    this.virtualPlugin.apply(compiler);
    this.applyEntryOption(compiler);
    this.applyBeforeResolve(compiler);
    this.applyAfterCompile(compiler);
    this.applyWatchRun(compiler);
  }

  /**
   * After context is established by webpack, scan for the declared modules we will shim.
   * Here we specially resolve typings and hold them for schema generator.
   */
  applyEntryOption(compiler: Compiler){
    compiler.hooks.entryOption.tap(this.name, (context) => {
      for(const request of this.modules){
        const location = resolveTypes(context, request);
        this.remoteModules.set(request, {
          location,
          files: new Set()
        });
      }
    })
  }

  /**
   * As we resolve modules, if we run into one marked for 
   * override, we generate the replacement proxy implementation. 
   */
  applyBeforeResolve(compiler: Compiler){
    compiler.hooks.normalModuleFactory.tap(this.name, (compilation: any) => {
      compilation.hooks.beforeResolve.tap(this.name, (result: any) => {
        const match = ensureModule(result.request);

        /*
         * Fetch polyfill is a dependancy of *this* plugin.
         * Explicitly resolve from here so webpack can bundle it.
         */
        if(match == DEFAULT_AGENT){
          result.request = require.resolve(match);
          return;
        }

        const module = match && this.remoteModules.get(match);

        if(module)
          result.request = this.writeReplacement(module);
      })
    });
  }

  /**
   * After first compilation, we need to watch our server's source files.
   * During development, backend code might be linked;
   * we should refresh where API might change with new server logic.
   */
  applyAfterCompile(compiler: Compiler){
    compiler.hooks.afterCompile.tap(this.name, (compilation) => {
      // This is also called by html-webpack-plugin but we want to skip that one.
      // Check if `compilation.name` was defined by that plugin, so we can bailout.
      if((compilation as any).name)
        return

      this.remoteModules.forEach(mod => {
        mod.files.forEach(file => {
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

      for(const mod of this.remoteModules.values()){
        let updates = 0;

        for(const name of filesUpdated)
          if(mod.files.has(name))
            updates++;

        if(updates)
          this.writeReplacement(mod);
      }
    })
  }
  
  writeReplacement(mod: RemoteModule){
    let location = mod.filename;

    if(location)
      return location;
    else {
      const { file, content, source } = generatePolyfill(mod, this.agent);
      this.virtualPlugin.writeModule(file, content);
      source.forEach(x => mod.files.add(x.file));
      return mod.filename = file;
    }
  }
}

module.exports = ApiReplacementPlugin;