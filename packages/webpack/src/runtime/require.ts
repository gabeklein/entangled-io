/// <reference path="../../../../node_modules/webpack/module.d.ts" />

import { entry, proxy } from './host';
import { log, warn } from './logs';


export interface WebpackExecOptions {
  id: string;
  module: NodeJS.Module & {
    hot?: webpack.Hot;
    parents: string[];
  }
}

export function webpackRequireCallback(options: WebpackExecOptions){
  const { module } = options;
  const { hot, parents } = module;

  let exports = {};
  
  Object.defineProperty(module, "exports", {
    configurable: true,
    set(value){
      Object.defineProperty(module, "exports", { value });
    },
    get: () => {
      if(Object.keys(exports).length){
        exports = bootstrap(options.id, exports, hot)
        Object.defineProperty(module, "exports", { value: exports });

        if(parents.length === 0)
          entry.call(options, exports);
      }

      return exports;
    }
  });
}

function bootstrap(id: string, exports: any, hot: webpack.Hot){
  const proxyExports = {};

  for(const name in exports){
    const value = proxy(`${id}:${name}`, exports[name]);
    
    // Duplicating webpack - why do these need to be getters?
    Object.defineProperty(proxyExports, name, {
      enumerable: true,
      get: () => value
    })
  }

  log(`Loaded module: ${id}`);

  hot.accept((error: Error, options: any) => {
    warn(`Loading module '${id}' failed due to error. Refresh module to try again.`);
  });

  return proxyExports;
}