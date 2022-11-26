import { ChildProcess, fork } from 'child_process';
import { Compiler, HotModuleReplacementPlugin, RuntimeModule } from 'webpack';

import ServicePlugin from './ServicePlugin';

class DevServerPlugin {
  name = "DevServerPlugin";

  apply(compiler: Compiler){
    const servicePlugin = new ServicePlugin();
    const hotPlugin = new HotModuleReplacementPlugin();

    let worker: ChildProcess | undefined;

    servicePlugin.apply(compiler);
    hotPlugin.apply(compiler);

    compiler.hooks.compilation.tap(this, compilation => {
      compilation.hooks.additionalTreeRuntimeRequirements.tap(
        this, chunk => {
          compilation.addRuntimeModule(chunk, new HotRuntimeModule());
        }
      );
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

class HotRuntimeModule extends RuntimeModule {
	constructor() {
		super("entangled hot runtime", RuntimeModule.STAGE_ATTACH);
	}

	generate(){
    const runtime = require.resolve("./runtime/hot");

    return `require("${runtime}")(__webpack_require__)`;
	}
}

export { DevServerPlugin };