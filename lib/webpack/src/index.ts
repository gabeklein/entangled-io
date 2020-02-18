import { collateTypes } from '@entangled/interface';
import path from 'path';
import { Compiler } from 'webpack';

import VirtualModulesPlugin from './virtual-modules-plugin';

export const toArray = <T> (value: T | Array<T>): Array<T> =>
  value ? Array.isArray(value) ? value : [value] : [];

const typeResolver = require("enhanced-resolve").create.sync({
  extensions: [".d.ts"],
  mainFields: ["types", "main"],
  resolveToContext: false,
  symlinks: true
});

module.exports = class EntangledAPIProxyPlugin {

  remoteModules = new Map<string, { location?: string, injected?: string }>();
  virtual = new VirtualModulesPlugin()

  constructor(options: any){
    for(const mod of ["@entangled/service"])
      this.remoteModules.set(mod, {})
  }

  apply(compiler: Compiler) {
    const NAME = this.constructor.name;

    const { virtual } = this;
    virtual.apply(compiler);

    compiler.hooks.entryOption.tap(NAME, 
      (context: string, entries: any) => {
        
        for(const request of this.remoteModules.keys())
          try {
            let resolved = typeResolver(context, request).replace(/\/lib\/index\.[^\\\/]+$/, "")
            this.remoteModules.get(request)!.location = resolved;
          }
          catch(err){
            throw new Error("Couldn't find types")
          }
      }
    )

    compiler.hooks.normalModuleFactory.tap(NAME, (compilation: any) => {
      compilation.hooks.beforeResolve.tap(NAME, (result: any) => {
        /** 
         * Fetch-agent is installed as a dependancy of this plugin.
         * Resolve from here so webpack can see it.
         * */
        if(result.request == "@entangled/fetch"){
          result.request = require.resolve("@entangled/fetch");
          return
        }

        if(this.remoteModules!.has(result.request)){
          let mod = this.remoteModules.get(result.request)!;

          if(!mod.injected){
            try {
              const uri = mod.injected = path.join(mod.location!, "entangled-agent.js");
              const schema = collateTypes(mod.location!).output.params[0];
              const injectSchema = JSON.stringify(schema);
              const initContent = `module.exports = require("@entangled/fetch").define(${injectSchema})`

              virtual.writeModule(uri, initContent)
            }
            catch(err){
              console.error(err);
              throw err;
            }
          }
          else
            console.log("OK yea this gets called more than once.")

          result.request = mod.injected
        }
      })
    });
  }
}