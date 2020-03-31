import { Entangled } from "@entangled/interface"

import express, { Express, json } from "express"
import { abstract } from './abstract';

import { origin } from './gates';

export function serve<R extends {}>(routes: R){
  const api = express();

  api.use(origin())
  api.use(json())
  
  applyPath(api, routes);

  return api as unknown as Entangled.API<R>
}

export function applied<R extends {}>(express: Express, routes: R){
  applyPath(express, routes);
  return void 0 as unknown as Entangled.API<R>
}

export function apply<R extends Entangled.API<any> | {}>(express: Express, routes: R){
  applyPath(express, routes);
}

export function cast<R extends {}>(routes: R){
  return routes as unknown as Entangled.API<R>
}

export function listen(api: Entangled.API<{}>, port: number | string){
  const surface = api as any;

  if(surface instanceof express)
    return (surface as any).listen(port);
  else {
    const app = express();
  
    app.use(origin())
    app.use(json());

    applyPath(app, api);
    app.listen(port)
  }
}

function applyPath(
  app: Express, 
  handle: Entangled.DefineRoute, 
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