import { Entangled } from '@entangled/interface';
import { Router } from 'express';

import { abstract } from './abstract';

export function createRoute(
  target: Router, 
  handle: Entangled.Schema | Function, 
  prefix = ""){

  if(typeof handle == "function")
    target.post(prefix, abstract(handle))
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

    if(typeof route === "function")
      scope[name] = forceAsync(route);
    else
      scope[name] = createNamespace(route);
  }
  
  return scope as Entangled.Namespace<any>;
}

function forceAsync(fn: Function){
  return async (...args: any[]) => fn(...args);
}