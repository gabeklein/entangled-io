import { Compiler, ExternalModule } from "webpack";

type PackageJSON = {
  name: string;
  version: string;
}

type Dependancies = {
  [name: string]: string;
}

export default class ExcludeModulesPlugin {
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