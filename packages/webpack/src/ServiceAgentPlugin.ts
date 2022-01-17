import { Compiler } from 'webpack';

import ImportAgentPlugin from './ImportAgentPlugin';

declare namespace ServiceAgent {
  interface Options {
    include: string;
    agent: string;
    options: {}
  }
}

class ServiceAgent {
  constructor(
    public options: ServiceAgent.Options
  ){}

  apply(compiler: Compiler){
    const opts = {
      ...this.options,
      single: true
    };

    new ImportAgentPlugin(opts).apply(compiler);
  }
}

export default ServiceAgent;