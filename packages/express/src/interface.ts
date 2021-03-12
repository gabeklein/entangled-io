import Entangled from '@entangled/interface';
import cookieParser from 'cookie-parser';
import express, { Express, json, Router } from 'express';

import { origin } from './gates';
import { createNamespace, createRoute } from './routes';

export class Service<R extends Entangled.Schema> {
  private logic: R;
  
  constructor(routes: R){
    this.logic = routes;
  }

  get Interface(): Entangled.Resources<"ENDPOINT", R> {
    const resources = createNamespace(this.logic);

    Object.defineProperty(this, "interface", { value: resources });

    return resources as any;
  };

  Endpoint<T extends string>(url: T): Entangled.Resources<T, R> {
    return this.Interface;
  }

  routes(){
    const routes = Router().use(json());
    createRoute(routes, this.logic);
    return routes;
  }

  listen(
    port: number, 
    callback?: (app: Express) => void){

    const app = express();
  
    app.use(origin());
    app.use(this.routes());
    app.use(cookieParser());

    if(callback)
      app.listen(port, () => callback(app));
    else
      app.listen(port);
    
    return app;
  }

  apply(to: Express | Router, root?: string){
    createRoute(to, this.logic, root)
  }
}