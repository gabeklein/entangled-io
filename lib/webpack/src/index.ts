import { Compiler } from "webpack";
import path from "path";
import { collateTypes } from "@entangled/interface"

const resolve = require("enhanced-resolve");
// import { bundle } from "@entangled/interface"
import { appendToFilesystem } from './stats';

const PLUGINID = "RemoteFunctionReplacementPlugin";

export const toArray = <T> (value: T | Array<T>): Array<T> =>
    value ? Array.isArray(value) ? value : [value] : [];

module.exports = class RemoteFunctionReplacementPlugin {

    devDeps = new Map<string, string>();

    constructor(options: any){
        for(const mod of ["@entangled/service"])
            this.devDeps.set(mod, "")
    }

    apply(compiler: Compiler) {
        compiler.hooks.entryOption.tap(PLUGINID, 
            (context: string, entries: any) => {
                const typeResolver = resolve.create.sync({
                    extensions: [".d.ts"],
                    mainFields: ["types", "main"],
                    resolveToContext: false,
                    symlinks: true
                });
                
                for(const request of this.devDeps.keys())
                    try {
                        let resolved = typeResolver(context, request)
                        this.devDeps.set(request, resolved.replace("/lib/index.d.ts", ""));
                    }
                    catch(err){
                        throw new Error("Couldn't find types")
                    }
            }
        )

        compiler.hooks.normalModuleFactory.tap(PLUGINID, (compilation: any) => {
            compilation.hooks.beforeResolve.tap(PLUGINID, (result: any) => {
                if(this.devDeps!.has(result.request)){
                    const context = this.devDeps.get(result.request)!;
                    const virtual = path.join(context, "entangled-agent.js");
                    const stuff = collateTypes(context);

                    void stuff;
                    debugger
                    const initContent = "module.exports = { foo: \'bar\' }"

                    appendToFilesystem(
                        compiler.inputFileSystem, 
                        virtual, 
                        initContent
                    );

                    result.request = virtual;
                }
            })
        });
    }
}