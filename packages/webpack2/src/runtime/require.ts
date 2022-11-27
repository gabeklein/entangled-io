/// <reference path="../../../../node_modules/webpack/module.d.ts" />

import { log, warn } from "./logs";

const REGISTER = new Map<string, Function>();
const LOOKUP = new WeakMap<Function, string>();

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
      if(Object.keys(exports).length)
        Object.defineProperty(module, "exports", {
          value: exports = bootstrap(options)
        });

      return exports;
    }
  });
}

function bootstrap(options: WebpackExecOptions){
  const { id, module } = options;
  const proxyExports = {};

  for(const name in exports){
    const uid = id + ":" + name;
    const value = proxy(uid, exports[name]);
    
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

function proxy(uid: string, value?: any){
  REGISTER.set(uid, value);

  if(typeof value == "function"){
    value = () =>
      REGISTER.get(uid)!.apply(null, arguments);
  
    LOOKUP.set(value, uid);
  }

  return value;
}