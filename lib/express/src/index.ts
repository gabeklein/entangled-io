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

export function listen(api: Entangled.API<{}>, port: number){
  return (api as unknown as Express).listen(port);
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