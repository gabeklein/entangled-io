import { Entangled } from "@entangled/interface"
import express, { Express, json, Router } from "express"

import { origin } from './gates';
import { applyPath } from './router';

const ROUTES = Symbol("__source_routes__");

export interface ExpressInterface {
  [ROUTES]: {};

  listen(port: number, cb?: (app: Express) => void): void;
  applyTo(to: Express, root?: string): void;
  routes(): Router;
}

function InterfaceFactory(
  this: ExpressInterface, routes: {}){

  this[ROUTES] = routes;
}

InterfaceFactory.prototype = {
  listen(port: number, cb?: (app: Express) => void){
    const app = express();
  
    app.use(origin())
    app.use(json());

    applyPath(app, this[ROUTES]);

    if(cb)
      app.listen(port, () => cb(app));
    else
      app.listen(port);
    
    return app;
  },

  routes(){
    const routes = Router();
    routes.use(json());
    applyPath(routes, this[ROUTES]);
    return routes;
  },

  applyTo(to: Express, root?: string){
    applyPath(to, this[ROUTES], root)
  }
}

interface LegalDefinition {
  listen?: never;
  applyTo?: never;
}

interface InterfaceConstructor {
  new <R extends Entangled.DefineRoutes & LegalDefinition>(routes: R): ExpressInterface & Entangled.Namespace<R>
}

const Interface = <InterfaceConstructor><Function>InterfaceFactory;

export { Interface }