import { RunScriptWebpackPlugin } from 'run-script-webpack-plugin';
import { Compiler, HotModuleReplacementPlugin } from 'webpack';
import { ChildProcess } from "child_process";
import ServicePlugin from './ServicePlugin';

class DevServerPlugin {
  name = "DevServerPlugin";

  apply(compiler: Compiler){
    const servicePlugin = new ServicePlugin();
    const hotPlugin = new HotModuleReplacementPlugin();
    const runPlugin = new RunScriptWebpackPlugin({
      autoRestart: false
    });

    let hotUpdate = false;

    servicePlugin.apply(compiler);
    hotPlugin.apply(compiler);
    runPlugin.apply(compiler);

    compiler.hooks.assetEmitted.tapPromise(this, async file => {
      if(/hot-update.json/.test(file))
        hotUpdate = true;
    })

    compiler.hooks.afterEmit.tapPromise(this, async compilation => {
      if(!hotUpdate || compilation.compiler !== compiler)
        return;

      hotUpdate = false;

      const worker = (runPlugin as any).worker as ChildProcess;

      worker.send({ type: "webpack_update" });
    });
  }
}

export default DevServerPlugin;