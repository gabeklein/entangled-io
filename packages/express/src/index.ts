import Entangled from '@entangled/interface';
import * as Express from 'express';

import { abstract } from './abstract';
import { setCustomError } from './errors';

export function service(exports: {}): Express.Router {
  const router = Express.Router().use(Express.json());

  function register(
    handle: Entangled.Schema | Function, 
    prefix = ""){

    if(typeof handle == "function")
      router.post(prefix, abstract(handle))
    else if(handle.prototype instanceof Error)
      setCustomError(handle as any, prefix);
    else
      for(const name in handle){
        let route = prefix;

        if(name !== "default")
          route += `/${name}`;

        register(handle[name], route);
      }
  }
  
  register(exports);

  return router;
}

export { useContext } from './async_hook';
export default service;