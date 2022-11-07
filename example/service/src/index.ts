import express, { Handler } from "express";
import { Service } from "@entangled/express";
import * as Api from "@example/api";

async function run(){
  const PORT = process.env.PORT || 8080;
  const entangled = new Service({ Api });
  const app = express();

  app.use(origin());
  app.use(entangled.routes());

  app.listen(PORT, () => {
    console.log(`Listening on port ${PORT}`)
  }) 
}

function origin(): Handler {
  return (req, res, next) => {
    res.header("Access-Control-Allow-Origin", "*");
    res.header("Access-Control-Allow-Headers", "*");
    res.header("Access-Control-Allow-Methods", "*");
  
    if(req.method === 'OPTIONS')
      res.sendStatus(200)
    else
      next();
  }
}

run();