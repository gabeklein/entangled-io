import service from '@entangled/express';
import express from 'express';

import * as MODULE_EXPORTS from '.';

async function run(port = 8080){
  const app = express();
  const api = service(MODULE_EXPORTS);

  app.use("/api", cors, api);

  app.listen(port, () => {
    console.log(`Listening on port ${port}`);
  }) 
}

const cors: express.Handler = (req, res, next) => {
  res.header("Access-Control-Allow-Origin", "*");
  res.header("Access-Control-Allow-Headers", "*");
  res.header("Access-Control-Allow-Methods", "*");

  if(req.method === 'OPTIONS')
    res.sendStatus(200);
  else
    next();
}

run();