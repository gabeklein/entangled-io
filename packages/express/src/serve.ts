import express from 'express';
import { Server } from 'http';

import { router } from './router';

interface Config {
  port?: number;
  baseUrl?: string;
  onError?: (this: Server, error: Error) => void;
  onReady?: (this: Server, port: number) => void;
}

declare namespace serve {
  export { Config };
}

function serve(module: {}, config: Config | number = {}){
  if (typeof config === "number")
    config = { port: config };
  
  const {
    port = 8080,
    baseUrl = "/api",
    onError,
    onReady
  } = config;

  const server = express()
    .use(baseUrl, router(module))
    .listen(port);

  if(onReady)
    server.on("listening", onReady.bind(server, port));

  if(onError)
    server.on("error", onError.bind(server));

  return server;
}

export { serve };