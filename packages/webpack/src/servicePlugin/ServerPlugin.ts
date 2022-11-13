import { RunScriptWebpackPlugin } from 'run-script-webpack-plugin';
import fs from 'fs';
import { resolve } from 'path';
import { Compiler, ExternalModule, HotModuleReplacementPlugin } from 'webpack';
import VirtualModulesPlugin from 'webpack-virtual-modules';

class ServerPlugin {
  name = "ServerPlugin";
  exists = false;

  apply(compiler: Compiler){
    const externalPlugin = new NodeExternalsPlugin();
    const hmrPlugin = new HotModuleReplacementPlugin();
    const modPlugin = new ModuleReplacePlugin();
    const runPlugin = new RunScriptWebpackPlugin({
      autoRestart: false
    });

    // modPlugin.apply(compiler);
    // hmrPlugin.apply(compiler);
    externalPlugin.apply(compiler);
    runPlugin.apply(compiler);
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

  virtualModules = new VirtualModulesPlugin();
  replaced = new Map<string, string>();
  compiler?: Compiler;

  apply(compiler: Compiler){
    this.virtualModules.apply(compiler);
    this.compiler = compiler;

    //gain access to module construction
    compiler.hooks.normalModuleFactory.tap(this, (compilation) => {
      //when a module is requested, but before webpack looks for it in filesystem
      compilation.hooks.beforeResolve.tap(this, (result) => {
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

          // if(!issuer){
          //   const moduleName = request.replace(/\.([jt]s)$/, `.serve.js`);

          //   if(moduleName == request)
          //     throw new Error("Incorrect file type.");

          //   const initPath = resolve(compiler.context, moduleName);
          //   const content = fs.readFileSync(resolve(__dirname, "hot.js"), "utf-8");

          //   this.virtualModules.writeModule(initPath, content);

          //   const resolved = resolve(compiler.context, moduleName);
            
          //   this.replaced.set(initPath, resolved);
          //   result.request = initPath;
          // }

          // let replaceWith: string | undefined;
  
          // const target = result.dependencies[0];
          // const replaceWith = this.test(target, result.request);

          //when a module is requested by the program as an entry point, NOT via require or import.
          // if (replaceWith) {
          // }
      
          return;
      });      
    });


  }
}

export default ServerPlugin;