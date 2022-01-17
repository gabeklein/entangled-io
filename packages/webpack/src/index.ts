import { Compiler } from 'webpack';

import CreateServicePlugin from './CreateServicePlugin';
import ImportAgentPlugin from './ImportAgentPlugin';

declare namespace MicroservicePlugin {
  interface Options {
    include?: RegExp | string;
    endpoint?: string;
    agent: string;
    adapter: string;
    namespace?: string;
  }
}

class MicroservicePlugin {
  constructor(
    public options: MicroservicePlugin.Options
  ){}

  apply(compiler: Compiler){
    const { options } = this;
    
    const createServicePlugin =
      new CreateServicePlugin(options);

    const importAgentPlugin =
      new ImportAgentPlugin(options, createServicePlugin);

    createServicePlugin.apply(compiler);
    importAgentPlugin.apply(compiler);
  }
}

export = MicroservicePlugin;