import path from "path";
import { Compiler, ExternalModule, SingleEntryPlugin } from "webpack";
import VirtualModulesPlugin from "webpack-virtual-modules";

const DEFAULT_RUNTIME = "@entangled/express";

export class RuntimeEntryPlugin {
  constructor(
    public runtime = DEFAULT_RUNTIME
  ){}

  apply(compiler: Compiler){
    const virtual = new VirtualModulesPlugin();
    const entry = path.resolve(compiler.context, "./microservice.js");
    const content = `require("${this.runtime}").default({ })`;

    virtual.apply(compiler);
    virtual.writeModule(entry, content);

    new SingleEntryPlugin(compiler.context, entry).apply(compiler);
  }
}

type PackageJSON = {
  name: string;
  version: string;
}

type Dependancies = {
  [name: string]: string;
}

export class ExternalNodeModulesPlugin {
  constructor(
    public report?: (deps: Dependancies) => void
  ){}

  apply(compiler: Compiler){
    const NAME = this.constructor.name;
    let dependencies = {} as { [pkg: string]: string };

    compiler.hooks.compile.tap(NAME, (params) => {
      const factory = params.normalModuleFactory;    
      dependencies = {};  

      factory.hooks.factorize.tapAsync(NAME, (data, callback) => {
        const module = data.dependencies[0].request;
        const resolver = factory.getResolver("normal", data.resolveOptions);
        const resolveContext = {
          fileDependencies: data.fileDependencies,
          missingDependencies: data.missingDependencies,
          contextDependencies: data.contextDependencies
        };

        resolver.resolve({}, data.context, module, resolveContext, (_err, result, info) => {
          if(result && /node_modules/.test(result)){
            const { name, version } = info!.descriptionFileData as PackageJSON;
            const external = new ExternalModule(name, "commonjs", name);

            dependencies[name] = version;
            callback(null, external);
          }
          else
            callback();
        });
      })
    })

    compiler.hooks.make.tap(NAME, (compilation) => {
      compilation.hooks.seal.tap(NAME, () => {
        if(this.report)
          this.report(dependencies);
      })
    })
  }
}