import { ChildProcess, fork } from 'child_process';
import { readFileSync } from 'fs';
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

    Object.values(compiler.options.entry).forEach((entry: any) => {
      entry.import.unshift(require.resolve("./hotEntry"));
    })

    compiler.hooks.compilation.tap(this, compilation => {
      compilation.hooks.additionalTreeRuntimeRequirements.tap(
        this, chunk => {
          compilation.addRuntimeModule(
            chunk, new HMRRuntimeModule()
          );
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

class HMRRuntimeModule extends RuntimeModule {
	constructor() {
		super("entangled runtime", RuntimeModule.STAGE_ATTACH);
	}

	generate(){
    return readFileSync(require.resolve("./runtime"), "utf-8");
	}
}

export default DevServerPlugin;