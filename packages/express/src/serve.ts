import express, { Express } from 'express';
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

/**
 * Serve entangled module as an express server.
 * 
 * @param module - Entangled module to serve.
 * @param config - Configuration object or port number.
 * @returns Listening server instance.
 */
function serve(module: {}, config: Config | number = {}){
  if (typeof config === "number")
    config = { port: config };
  
  const {
    port = 8080,
    baseUrl = "/api",
    onError,
    onReady
  } = config;

  const server = service(module, baseUrl).listen(port);

  if(onReady)
    server.on("listening", onReady.bind(server, port));

  if(onError)
    server.on("error", onError.bind(server));

  return server;
}

/**
 * Exress server with entangled module.
 * 
 * @param module - Entangled module to serve.
 * @param baseUrl - Base URL for the API.
 * @returns Express application instance.
 */
function service(module: {}, baseUrl = "/api"): Express {
  return express().use(baseUrl, router(module))
}

export { serve, service };