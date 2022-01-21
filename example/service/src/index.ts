import express from "express";
import { Service } from "@entangled/express";
import * as Api from "@example/api";

async function run(){
  const PORT = process.env.PORT || 8080;
  const entangled = new Service({ Api });
  const app = express();

  app.use(entangled.routes());

  app.listen(PORT, () => {
    console.log(`Listening on port ${PORT}`)
  }) 
}

run();