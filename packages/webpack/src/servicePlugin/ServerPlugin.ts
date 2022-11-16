import fs from 'fs';
import { resolve } from 'path';
import { Compiler, ExternalModule, NormalModule } from 'webpack';
import VirtualModulesPlugin from 'webpack-virtual-modules';

class ServerPlugin {
  name = "ServerPlugin";
  exists = false;

  apply(compiler: Compiler){
    const externalPlugin = new NodeExternalsPlugin();
    const modPlugin = new ModuleReplacePlugin();

    modPlugin.apply(compiler);
    externalPlugin.apply(compiler);
  }
}

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
  replaced = new Map<string, string>();

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
      //when a module is requested, but before webpack looks for it in filesystem
      factory.hooks.beforeResolve.tap(this, (result) => {
          const thisModule = "__this__";
          const issuer = result.contextInfo.issuer;
          const replaced = this.replaced.get(issuer);
          const { request } = result;

          if(replaced){
            if(request == thisModule)
              result.request = replaced;
            else if(request.startsWith("./"))
              result.request = resolve(__dirname, request);

            return;
          }

          if(!issuer){
            const moduleName = request.replace(/\.([jt]s)$/, `.serve.js`);

            if(moduleName == request)
              throw new Error("Incorrect file type.");

            const original = resolve(compiler.context, request);
            const wrapper = resolve(compiler.context, moduleName);
            const content = fs.readFileSync(resolve(__dirname, "poll.js"), "utf-8");

            this.virtual.writeModule(wrapper, content);

            this.replaced.set(wrapper, original);
            result.request = wrapper;
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

export default ServerPlugin;