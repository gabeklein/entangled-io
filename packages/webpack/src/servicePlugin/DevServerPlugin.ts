import { ChildProcess, fork } from 'child_process';
import { resolve } from 'path';
import { Compiler, HotModuleReplacementPlugin, NormalModule } from 'webpack';

import ServicePlugin from './ServicePlugin';

class DevServerPlugin {
  name = "DevServerPlugin";

  apply(compiler: Compiler){
    const servicePlugin = new ServicePlugin();
    const hotPlugin = new HotModuleReplacementPlugin();

    let worker: ChildProcess | undefined;

    servicePlugin.apply(compiler);
    hotPlugin.apply(compiler);

    Object.values(compiler.options.entry).forEach((entry: any) => {
      const hotEntry = require.resolve("./hotEntry");
      entry.import.unshift(hotEntry);
    })

    compiler.hooks.compilation.tap(this, compilation => {
      const hooks = NormalModule.getCompilationHooks(compilation);
      
      hooks.beforeLoaders.tap(this, (_, normalModule) => {
        if(/hotEntry/.test(normalModule.resource))
          return;

        normalModule.loaders.unshift({
          loader: resolve(__dirname, "./hotModuleLoader.js")
        } as any);
      })
    })

    compiler.hooks.shouldEmit.tap(this, comp => {
      const [ updateChunk ] = comp.additionalChunkAssets;

      if(!updateChunk)
        return true;

      if(worker)
        worker.send(comp.assets[updateChunk].source());
        
      return false;
    })

    compiler.hooks.afterEmit.tapPromise(this, async compilation => {
      if(worker || compilation.compiler !== compiler)
        return;

      const { output } = compilation.compiler.options;
      const name = Object.keys(compilation.assets)[0];

      if(!output || !output.path)
        throw new Error('output.path should be defined in webpack config!');

      const script = `${output.path}/${name}`;
      
      worker = fork(script, [], {
        execArgv: process.execArgv,
        stdio: 'inherit'
      });

      return new Promise<void>(resolve => {
        setTimeout(resolve, 0)
      });
    })
  }
}

export default DevServerPlugin;