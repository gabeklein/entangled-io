import { Compiler } from 'webpack';

import CreateServicePlugin from './CreateServicePlugin';
import ServiceAgentPlugin from './ServiceAgentPlugin';

declare namespace MicroservicePlugin {
  interface Options {
    include?: RegExp | string;
    endpoint?: string;
    agent: string;
    adapter: string;
    namespace?: string;
  }
}

export default class MicroservicePlugin {
  constructor(
    public options: MicroservicePlugin.Options
  ){}

  apply(compiler: Compiler){
    const { options } = this;
    
    const createServicePlugin =
      new CreateServicePlugin(options);

    const importAgentPlugin =
      new ServiceAgentPlugin(options, (request, uid) => {
        createServicePlugin.include(request, uid)
      });

    createServicePlugin.apply(compiler);
    importAgentPlugin.apply(compiler);
  }
}