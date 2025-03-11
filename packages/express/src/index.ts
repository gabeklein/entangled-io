import Entangled from '@entangled/interface';
import express from 'express';

import { abstract } from './abstract';
import { setCustomError } from './errors';

const noCors: express.Handler = (req, res, next) => {
  res.header("Access-Control-Allow-Origin", "*");
  res.header("Access-Control-Allow-Headers", "*");
  res.header("Access-Control-Allow-Methods", "*");

  if(req.method === 'OPTIONS')
    res.sendStatus(200);
  else
    next();
}

function serve(module: {}, baseUrl = "/api", port = 8080){
  const app = express();
  const api = service(module);

  app.use(baseUrl, noCors, api);

  app.listen(port, () => {
    console.log(`Listening on port ${port}`);
  }) 
}

function service(exports: {}): express.Router {
  const router = express.Router().use(express.json());

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

export { serve, service };
export { useContext } from './async_hook';
export default serve;