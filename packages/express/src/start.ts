import Entangled from '@entangled/interface';
import express, { Handler, Express } from 'express';

import { Service } from './interface';

export default function start<R extends Entangled.Schema>(
  schema: R,
  middlewares: Handler[],
  callback: ((app: Express) => void) | false): Service<R> {

  const { listen } = require("simple-argv");
  const service = new Service(schema);

  if(listen){
    const port =
      typeof listen == "number" ? listen :
      Number(process.env.PORT) || 8080;

    const app = express();

    for(const middle of middlewares)
      app.use(middle);

    app.use(service.routes());

    if(callback)
      app.listen(port, () => callback(app));
    else
      app.listen(port, callback === false ? undefined : () => {
        console.log(`Entangled service is running on port ${port}.`);
      });
  }

  return service;
}