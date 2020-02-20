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

  /** Simple cache of requires tagged for replacement. */
  remoteModules = new Map<string, RemoteModule>();

  /** A seperate plugin for adding generated files to bundle. */
  virtualPlugin = new VirtualModulesPlugin();

  constructor(mods: string[] = []){
    for(const mod of mods)
      this.remoteModules.set(mod, { watched: new Set() })
  }
  
  generateAgentModule(mod: RemoteModule){
    const uri = path.join(mod.location!, "entangled-agent.js");
    const parsed = collateTypes(mod.location!);
    const computed = parsed.output.params[0];
    const injectSchema = JSON.stringify(computed);
    const initContent = `module.exports = require("@entangled/fetch").define(${injectSchema})`

    this.virtualPlugin.writeModule(uri, initContent);

    mod.injected = uri;
    parsed.cache.forEach(
      x => mod.watched.add(x.file)
    );
  }

  apply(compiler: Compiler) {
    const NAME = this.constructor.name;

    this.virtualPlugin.apply(compiler);

    compiler.hooks.entryOption.tap(NAME, (context) => {
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

    compiler.hooks.normalModuleFactory.tap(NAME, (compilation: any) => {
      compilation.hooks.beforeResolve.tap(NAME, (result: any) => {
        /*
         * API polyfill is installed as a dependancy of this plugin.
         * Explicitly resolve from here so webpack can bundle it.
         */
        if(result.request == "@entangled/fetch"){
          result.request = require.resolve("@entangled/fetch");
          return;
        }

        let mod = this.remoteModules.get(result.request);

        if(!mod) return;

        if(!mod.injected)
          try { this.generateAgentModule(mod) }
          catch(err){
            console.error(err);
            throw err;
          }

        result.request = mod.injected
      })
    });

    compiler.hooks.afterCompile.tap(NAME, (compilation) => {
      /* 
       * Hook is also called by html-webpack-plugin but we want to skip that one.
       * `compilation.name` is defined by the plugin, so we can bailout.
       */
      if((compilation as any).name)
        return

      this.remoteModules.forEach(mod => {
        mod.watched.forEach(file => {
          compilation.fileDependencies.add(file)
        })
      })
    })

    compiler.hooks.watchRun.tap(NAME, (compilation) => {
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