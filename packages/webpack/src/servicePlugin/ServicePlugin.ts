import { resolve, dirname } from 'path';
import { Compiler, ExternalModule, NormalModule } from 'webpack';
import VirtualModulesPlugin from 'webpack-virtual-modules';

class ServicePlugin {
  name = "ServicePluign";

  apply(compiler: Compiler){
    const externalPlugin = new NodeExternalsPlugin();
    const modPlugin = new ModuleReplacePlugin();

    modPlugin.apply(compiler);
    externalPlugin.apply(compiler);
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

class ModuleReplacePlugin {
  name = "ModuleReplacePlugin";
  virtual = new VirtualModulesPlugin();

  apply(compiler: Compiler){
    this.virtual.apply(compiler);

    compiler.hooks.compilation.tap(this, compilation => {
      const hooks = NormalModule.getCompilationHooks(compilation);
      
      hooks.beforeLoaders.tap(this, (_, normalModule) => {
        if(/src\/index/.test(normalModule.resource))
          return;

        const loader = resolve(__dirname, "./hotModuleLoader.js");

        normalModule.loaders.unshift({ loader } as any);
      })
    })

    //gain access to module construction
    compiler.hooks.normalModuleFactory.tap(this, (factory) => {
      const replacement = new Map<string, {
        module: string;
        proxy: string;
      }>();

      //when a module is requested, but before webpack looks for it in filesystem
      factory.hooks.beforeResolve.tap(this, (result) => {
          const issuer = result.contextInfo.issuer;
          const replaced = replacement.get(issuer);
          const { request } = result;

          if(replaced){
            const { module, proxy } = replaced;

            if(request == "__this__")
              result.request = module;
            else if(request.startsWith("."))
              result.request = resolve(dirname(proxy), request);

            return;
          }

          if(!issuer){
            const moduleName = request.replace(/\.([jt]s)$/, `.serve.js`);

            if(moduleName == request)
              throw new Error("Incorrect file type.");

            const hotEntryFile = require.resolve("./hotEntry");
            const content = [
              `module.exports = require("__this__");`,
              `require("${hotEntryFile}");`
            ];

            const original = resolve(compiler.context, request);
            const wrapper = resolve(compiler.context, moduleName);

            this.virtual.writeModule(wrapper, content.join("\n"));

            result.request = wrapper;
            replacement.set(wrapper, {
              module: original,
              proxy: hotEntryFile
            });
          }

          // let replaceWith: string | undefined;
  
          // const target = result.dependencies[0];
          // const replaceWith = this.test(target, result.request);

          //when a module is requested by the program as an entry point, NOT via require or import.
          // if (replaceWith) {
          // }
      });      
    });
  }
}