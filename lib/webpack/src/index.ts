import { Compiler } from "webpack";
import path from "path";
import fs from "fs";
import { bundle } from "@entangled/interface"
// import * as TJS from "typescript-json-schema";

// import parser from "@typescript-eslint/parser";

const PLUGINID = "RemoteFunctionReplacementPlugin";

export const toArray = <T> (value: T | Array<T>): Array<T> =>
    value ? Array.isArray(value) ? value : [value] : [];

function rootDevDependancies(module: string){
    const pkg = path.resolve(module, "package.json")

    if(!fs.existsSync(pkg))
        throw new Error(`Could not find module's package.json`)

    if(!fs.lstatSync(pkg).isFile())
        throw new Error(`How is package.json not a file here?`)

    const pkgjson = fs.readFileSync(pkg, "utf-8");
    const { devDependencies: deps } = JSON.parse(pkgjson);
    
    return new Set(deps ? Object.keys(deps) : []);
}

// function openFile(path: string){
//     if(!fs.existsSync(path))
//         throw new Error(`Could not find module's package.json`)

//     if(!fs.lstatSync(path).isFile())
//         throw new Error(`Requested file ${path} is not a file.`)

//     return new Promise((resolve, reject) => {
//         fs.readFile(path, { encoding: "utf-8" }, (err, file) => {
//             if(err) reject(err);
//             else resolve(file);
//         })
//     });
// }

module.exports = class RemoteFunctionReplacementPlugin {

    devDeps?: Set<string>;

    constructor(options: any){
    }

    apply(compiler: Compiler) {

        compiler.hooks.entryOption.tap(PLUGINID, 
            (context: string, entries: any) => {
                this.devDeps = rootDevDependancies(context);
            }
        )

        //gain access to module construction
        compiler.hooks.normalModuleFactory.tap(PLUGINID, (compilation: any) => {
            //when a module is requested, but before webpack looks for it in filesystem
            // compilation.hooks.beforeResolve.tap(PLUGINID, (result: any) => {
            //     const target = result.dependencies[0];
            //     const {
            //         request
            //     } = result;

            //     // if(this.devDeps!.has(request))
            //     //     debugger

            //     // debugger

            //     void request, target
            // });

            compilation.hooks.afterResolve.tapAsync(PLUGINID, (result: any, cb: () => void) => {

                const maybeTypeFile = result.request.replace(/\.js$/, ".d.ts");

                if(this.devDeps!.has(result.rawRequest)){

                    const contents = bundle(maybeTypeFile, result.rawRequest)

                    void contents;

                    debugger


                    // const contents = openFile(maybeTypeFile).then(() => {
                    //     const parser = require("@typescript-eslint/parser");
                    //     debugger
                    //     const stuff = parser.parse(contents, {
                    //         // tsconfigRootDir: result
                    //         // filePath: maybeTypeFile
                            
                    //     })
                    //     void stuff
                    //     debugger
                    //     // debugger
                    // })

                    // debugger

                    // const parser = require("@typescript-eslint/parser");

                    // const stuff = parser.parse(contents, {
                    //     // tsconfigRootDir: result
                    //     // filePath: maybeTypeFile
                        
                    // })
                    // void stuff;

                    // debugger
                }

                else cb();

                void maybeTypeFile;
            });
        });
    }
}