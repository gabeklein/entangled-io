import Entangled from '@entangled/interface';
import { json, Router } from 'express';

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
}