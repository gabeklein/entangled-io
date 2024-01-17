import service from '@entangled/express';
import express, { Handler } from 'express';

import * as API from '.';

async function run(){
  const PORT = 8080;
  const entangled = service(API);
  const app = express();

  app.use("/api", cors, entangled);

  app.listen(PORT, () => {
    console.log(`Listening on port ${PORT}`);
  }) 
}

const cors: Handler = (req, res, next) => {
  res.header("Access-Control-Allow-Origin", "*");
  res.header("Access-Control-Allow-Headers", "*");
  res.header("Access-Control-Allow-Methods", "*");

  if(req.method === 'OPTIONS')
    res.sendStatus(200)
  else
    next();
}

run();