import { collateTypes } from '@entangled/interface';
import path from 'path';
import { Compiler } from 'webpack';

import { appendToFilesystem } from './stats';

const PLUGINID = "EntangledAPIProxyPlugin";

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

    constructor(options: any){
        for(const mod of ["@entangled/service"])
            this.remoteModules.set(mod, {})
    }

    apply(compiler: Compiler) {
        compiler.hooks.entryOption.tap(PLUGINID, 
            (context: string, entries: any) => {
                
                for(const request of this.remoteModules.keys())
                    try {
                        let resolved = typeResolver(context, request).replace(/\/lib\/index\.[^\\\/]+$/, "")
                        this.remoteModules.set(request, resolved);
                    }
                    catch(err){
                        throw new Error("Couldn't find types")
                    }
            }
        )

        compiler.hooks.normalModuleFactory.tap(PLUGINID, (compilation: any) => {
            compilation.hooks.beforeResolve.tap(PLUGINID, (result: any) => {
                /** 
                 * Fetch-agent is installed as a dependancy of _this_ module.
                 * Resolve from here so webpack can see it.
                 * */
                if(result.request == "@entangled/agent"){
                    result.request = require.resolve("@entangled/agent");
                    return
                }

                if(this.remoteModules!.has(result.request)){
                    let mod = this.remoteModules.get(result.request)!;

                    if(!mod.injected)
                        mod.injected = injectAgent(compiler, mod.location!);
                    else
                        console.log("OK yea this gets called more than once.")

                    result.request = mod.injected
                }
            })
        });
    }
}

function findAPIParameter(parameterized: any){
    return parameterized.params[0]
}

function injectAgent(compiler: any, location: string){
    const fakeURI = path.join(location, "entangled-agent.js");
    const schema = findAPIParameter(collateTypes(location).output);
    const inject = JSON.stringify(schema);
    const initContent = `module.exports = require("@entangled/agent").define(${inject})`

    appendToFilesystem(compiler.inputFileSystem, fakeURI, initContent);

    return fakeURI;
}