import service from '@entangled/express';
import express from 'express';

import * as API from '.';

async function run(){
  const PORT = 8080;
  const entangled = service(API);
  const app = express();

  app.use("/api", entangled);

  app.listen(PORT, () => {
    console.log(`Listening on port ${PORT}`);
  }) 
}

run();