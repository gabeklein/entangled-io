import { collateTypes } from '@entangled/interface';
import path from 'path';
import { Compiler } from 'webpack';

import VirtualModulesPlugin from './virtual-modules-plugin';

/** Customized webpack resolver to look for .d.ts files. */
const specialResolver = require("enhanced-resolve").create.sync({
  extensions: [".d.ts"],
  mainFields: ["types", "main"],
  resolveToContext: false,
  symlinks: true
});

type RemoteModule = {
  location?: string
  injected?: string
  watched: Set<string>
};

class ApiReplacementPlugin {
  /** Using name of class itself for plugin hooks. */
  name = this.constructor.name;

  /** Simple cache of requires tagged for replacement. */
  remoteModules = new Map<string, RemoteModule>();

  /** A seperate plugin for managing imaginary files in our bundle. */
  virtualPlugin = new VirtualModulesPlugin();

  /** Consume list of modules we want to proxy on client. */
  constructor(mods: string[] = []){
    for(const mod of mods)
      this.remoteModules.set(mod, { watched: new Set() })
  }
  
  generateAgentModule(mod: RemoteModule){
    const uri = path.join(mod.location!, "entangled-agent.js");
    const parsed = collateTypes(mod.location!);
    const { output } = parsed;

    const potentialExports = [
      [null, output], 
      ...Object.entries(output)
    ];
    
    let computed;

    for(const [key, target] of potentialExports){
      const { params } = target;
      if(params){
        computed = target.params[0];
        if(typeof key == "string")
          computed = { [key]: computed }
        break;
      }
    }
    
    const injectSchema = JSON.stringify(computed);
    const initContent = `module.exports = require("@entangled/fetch").define(${injectSchema})`

    this.virtualPlugin.writeModule(uri, initContent);

    mod.injected = uri;
    parsed.cache.forEach(
      x => mod.watched.add(x.file)
    );
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
      this.remoteModules.forEach((mod, request) => {
        let resolved;

        try {
          resolved = specialResolver(context, request);
        }
        catch(err){
          console.error(err)
          throw new Error("Couldn't find types")
        }

        const resolvedContext = 
          resolved.replace(/\/lib\/index\.[^\\\/]+$/, "");

        mod.location = resolvedContext;
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
        /*
         * API polyfill is installed as a dependancy of this plugin.
         * Explicitly resolve from here so webpack can bundle it.
         */
        if(result.request == "@entangled/fetch"){
          result.request = require.resolve("@entangled/fetch");
          return;
        }

        //TODO improve handling of these requests
        const match = /^((?:@\w+\/)?\w+)/.exec(result.request);

        if(!match) return;

        let mod = this.remoteModules.get(match[1]);

        if(!mod) return;

        if(!mod.injected)
          try { this.generateAgentModule(mod) }
          catch(err){
            console.error(err);
            throw err;
          }

        result.request = mod.injected;
      })
    });
  }

  /**
   * After first compilation, we need to watch our "server" source files.
   * During development, where backend code is linked, we should refresh
   * when API is expected to change following the server logic.
   */
  applyAfterCompile(compiler: Compiler){
    compiler.hooks.afterCompile.tap(this.name, (compilation) => {
      // Hook is also called by html-webpack-plugin but we want to skip that one.
      // Notice `compilation.name` is defined by the plugin, so we can bailout.
      if((compilation as any).name)
        return

      this.remoteModules.forEach(mod => {
        mod.watched.forEach(file => {
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

      this.remoteModules.forEach(mod => {
        const watchFilesUpdated = 
          filesUpdated.filter(x => mod.watched.has(x));

        if(watchFilesUpdated.length)
          this.generateAgentModule(mod);
      })
    })
  }
}

module.exports = ApiReplacementPlugin;