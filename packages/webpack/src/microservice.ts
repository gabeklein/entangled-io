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

export class ExternalNodeModulesPlugin {
  apply(compiler: Compiler){
    const NAME = this.constructor.name;

    compiler.hooks.compile.tap(NAME, ({ normalModuleFactory }) => {
      normalModuleFactory.hooks.factorize.tapAsync(NAME, (data, callback) => {
        const module = data.dependencies[0].request;
        const resolver = normalModuleFactory.getResolver("normal", data.resolveOptions);
        const resolveContext = {
          fileDependencies: data.fileDependencies,
          missingDependencies: data.missingDependencies,
          contextDependencies: data.contextDependencies
        };

        resolver.resolve({}, data.context, module, resolveContext, (_err, result) => {
          if(result && /node_modules/.test(result))
            callback(null,
              new ExternalModule(module, "commonjs", module)
            );
          else
            callback();
        });
      })
    })
  }
}