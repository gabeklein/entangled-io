import { ChildProcess, fork } from 'child_process';
import { Compiler, HotModuleReplacementPlugin, RuntimeModule } from 'webpack';
import ExcludeModulesPlugin from '../ExcludeModulesPlugin';

class DevServerPlugin {
  name = "DevServerPlugin";
  worker: ChildProcess | undefined;

  apply(compiler: Compiler){
    const hotPlugin = new HotModuleReplacementPlugin();
    const nodeModules = new ExcludeModulesPlugin();

    hotPlugin.apply(compiler);
    nodeModules.apply(compiler);

    /** Inject HMR runtime */
    compiler.hooks.compilation.tap(this, compilation => {
      compilation.hooks.additionalTreeRuntimeRequirements.tap(
        this, chunk => {
          compilation.addRuntimeModule(chunk, new HotRuntimeModule());
        }
      );
    });

    /** Intercept emitted assets */
    compiler.hooks.shouldEmit.tap(this, comp => {
      const [ updateChunk ] = comp.additionalChunkAssets;

      if(!updateChunk)
        return true;

      if(this.worker)
        this.worker.send(comp.assets[updateChunk].source());
        
      return false;
    })

    compiler.hooks.afterEmit.tap(this, (compilation) => {
      if(this.worker || compilation.compiler !== compiler)
        return;

      const { output } = compilation.compiler.options;
      const name = Object.keys(compilation.assets)[0];

      if(!output || !output.path)
        throw new Error('output.path should be defined in webpack config!');

      this.worker = fork(`${output.path}/${name}`, [], {
        execArgv: process.execArgv,
        stdio: 'inherit'
      });
    })
  }
}

export default DevServerPlugin;

class HotRuntimeModule extends RuntimeModule {
	constructor() {
		super("entangled hot runtime", RuntimeModule.STAGE_ATTACH);
	}

	generate(){
    const runtime = require.resolve("./hotRuntime");

    return `require("${runtime}")(__webpack_require__)`;
	}
}