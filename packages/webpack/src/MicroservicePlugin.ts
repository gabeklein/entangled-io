import { Compiler } from 'webpack';

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
    const requests = {} as {
      [uid: string]: string;
    }

    const importAgentPlugin =
      new ServiceAgentPlugin(options, (request, uid) => {
        requests[uid] = request;
      });

    importAgentPlugin.apply(compiler);

    // compiler.hooks.tapPromise("MicroservicePlugin", async () => {
    //   debugger;
    // })
  }
}