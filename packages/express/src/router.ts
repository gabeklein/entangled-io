import { Entangled } from '@entangled/interface';
import { Express } from 'express';

import { abstract } from './abstract';

export function applyPath(
  app: Express, 
  handle: Entangled.DefineRoutes | Function, 
  prefix = ""){

  if(typeof handle == "function")
    app.post(prefix, abstract(handle))
  else
    for(const name in handle){
      let route = prefix;
      if(name !== "default")
        route += `/${name}`;
      applyPath(app, handle[name], route);
    }
}