import { Compiler, ExternalModule } from 'webpack';

class ServicePlugin {
  name = "ServicePluign";

  apply(compiler: Compiler){
    new NodeExternalsPlugin().apply(compiler);
  }
}

export default ServicePlugin;

class NodeExternalsPlugin {
  name = "NodeExternalsPlugin";

  apply(compiler: Compiler){
    compiler.hooks.normalModuleFactory.tap(this, nmf => {
      nmf.hooks.resolve.tapPromise(
        {
          name: 'NodeExternalsPlugin',
          stage: 100,
        },
        async (module) => {
          const { request } = module;

          if(/node_modules/.test(module.createData.resource || ""))
            return new ExternalModule(request, "commonjs", request);

          return;
        },
      );
    })
  }
}