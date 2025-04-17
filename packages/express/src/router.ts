import Entangled from '@entangled/interface';
import express from 'express';

import { abstract } from './abstract';
import { setCustomError } from './errors';

const cors = (): express.Handler => (req, res, next) => {
  res.header("Access-Control-Allow-Origin", "*");
  res.header("Access-Control-Allow-Headers", "*");
  res.header("Access-Control-Allow-Methods", "*");

  if(req.method === 'OPTIONS')
    res.sendStatus(200);
  else
    next();
}

export function router(exports: {}): express.Router {
  const router = express.Router();

  router.use(express.json());
  router.use(cors());

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