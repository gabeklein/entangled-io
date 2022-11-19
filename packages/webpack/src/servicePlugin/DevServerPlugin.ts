import { ChildProcess, fork } from 'child_process';
import { Compiler, HotModuleReplacementPlugin } from 'webpack';

import ServicePlugin from './ServicePlugin';

class DevServerPlugin {
  name = "DevServerPlugin";

  apply(compiler: Compiler){
    const servicePlugin = new ServicePlugin();
    const hotPlugin = new HotModuleReplacementPlugin();

    let hotUpdate = false;
    let worker: ChildProcess | undefined;

    servicePlugin.apply(compiler);
    hotPlugin.apply(compiler);

    compiler.hooks.assetEmitted.tapPromise(this, async file => {
      if(/hot-update.json/.test(file))
        hotUpdate = true;
    })

    compiler.hooks.afterEmit.tapPromise(this, async compilation => {
      if(compilation.compiler !== compiler)
        return;

      if(worker){
        if(hotUpdate){
          hotUpdate = false;
          worker.send({ type: "webpack_update" });
        }

        return;
      }

      const { output } = compilation.compiler.options;
      const name = Object.keys(compilation.assets)[0];

      if(!output || !output.path)
        throw new Error('output.path should be defined in webpack config!');

      const script = `${output.path}/${name}`;
      
      worker = fork(script, [], {
        execArgv: process.execArgv,
        stdio: 'inherit'
      });

      await new Promise(resolve => {
        setTimeout(resolve, 0)
      });
    })
  }
}

export default DevServerPlugin;