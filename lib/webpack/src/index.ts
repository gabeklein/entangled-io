import { Compiler } from "webpack";
import path from "path";
import fs from "fs";
// import { bundle } from "@entangled/interface"

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

        compiler.hooks.normalModuleFactory.tap(PLUGINID, (compilation: any) => {
            compilation.hooks.afterResolve.tapAsync(PLUGINID, (result: any, cb: () => void) => {
                const { rawRequest, request } = result;

                if(this.devDeps!.has(rawRequest)){
                    const {
                        descriptionFileData: pkg,
                        descriptionFileRoot: root,
                        relativePath: main
                    } = result.resourceResolveData;

                    // const maybeTypeFile = main.replace(/\.js$/, ".d.ts");
                    // const contents = bundle(root, maybeTypeFile, rawRequest)

                    void main, pkg, root, request;

                    debugger
                }

                else cb();
            });
        });
    }
}