import * as Express from 'express';

import { createRoute } from './routes';

export function service(exports: {}): Express.Handler {
  const router = Express.Router().use(Express.json());
  
  createRoute(router, exports);

  return (req, res, next) => router(req, res, next);
}