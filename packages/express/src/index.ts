import { Entangled } from '@entangled/interface';
import express, { Express, json } from 'express';

import { origin } from './gates';
import { applyPath } from './router';

export { Interface } from './interface'

export function serve<R extends {}>(routes: R){
  const api = express();

  api.use(origin())
  api.use(json())
  
  applyPath(api, routes);

  return api as unknown as Entangled.Namespace<R>
}

export function applied<R extends {}>(express: Express, routes: R){
  applyPath(express, routes);
  return void 0 as unknown as Entangled.Namespace<R>
}

export function apply<R extends Entangled.Namespace<any> | {}>(express: Express, routes: R){
  applyPath(express, routes);
}

export function cast<R extends {}>(routes: R){
  return routes as unknown as Entangled.Namespace<R>
}

export function listen(api: Entangled.Namespace<{}>, port: number | string){
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