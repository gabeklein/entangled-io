/// <reference path="../../../../node_modules/webpack/module.d.ts" />

import { log, warn } from "./logs";

const FUNCTION_REGISTER = new Map<string, Map<string, Function>>();

interface WebpackExecOptions {
  id: string;
  module: NodeJS.Module & {
    hot?: webpack.Hot;
    parents: string[];
  }
}

export function webpackRequireCallback(options: WebpackExecOptions){
  const { module } = options;

  let exports = {};
  
  Object.defineProperty(module, "exports", {
    configurable: true,
    get: () => {
      if(Object.keys(exports).length){
        exports = bootstrap(options);
        Object.defineProperty(module, "exports", { value: exports });
      }
    
      return exports;
    }
  });
}

function bootstrap(options: WebpackExecOptions){
  const { module, id } = options;

  let register = FUNCTION_REGISTER.get(id);

  if(!register)
    FUNCTION_REGISTER.set(id, register = new Map());

  const proxyExports = {};

  for(const name in exports){
    let value = exports[name];

    if(typeof value == "function"){
      register.set(name, value);
      value = (...args: any[]) => (
        register!.get(name)!.apply(null, args)
      );
    }
    
    Object.defineProperty(proxyExports, name, {
      enumerable: true,
      get: () => value
    })
  }

  log(`Loaded module: ${id}`);

  module.hot.accept((error: Error, options: any) => {
    warn(`Loading module '${id}' failed due to error. Refresh module to try again.`);
  });

  return proxyExports;
}