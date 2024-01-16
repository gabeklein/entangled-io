import Entangled from '@entangled/interface';
import { Router } from 'express';

import { abstract } from './abstract';
import { setCustomError } from './errors';

export function createRoute(
  target: Router, 
  handle: Entangled.Schema | Function, 
  prefix = ""){

  if(typeof handle == "function"){
    if(handle.prototype instanceof Error)
      setCustomError(handle as any, prefix);
    else 
      target.post(prefix, abstract(handle))
  }
  else
    for(const name in handle){
      let route = prefix;
      if(name !== "default")
        route += `/${name}`;
      createRoute(target, handle[name], route);
    }
}

export function createNamespace(branch: Entangled.Schema){
  const { default: defaultEntry, ...routes } = branch;
  const scope: any = defaultEntry || {};

  for(const name in routes){
    const route = routes[name];

    scope[name] = typeof route === "function"
      ? forceAsync(route)
      : createNamespace(route);
  }
  
  return scope as Entangled.Namespace<any>;
}

function forceAsync(fn: Function){
  return async (...args: any[]) => fn(...args);
}