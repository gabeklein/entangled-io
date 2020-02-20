import { RequestHandler } from "express";

export function origin(origin: string = "*"): RequestHandler {
  return (req, res, next) => {
    res.header('Access-Control-Allow-Origin', origin);
    res.header('Access-Control-Allow-Methods', '*');
    res.header('Access-Control-Allow-Headers', 'Content-Type, Authorization, Content-Length, X-Requested-With');
  
    if(req.method === 'OPTIONS')
      res.sendStatus(200);
    else 
      next();
  }
}

export function authorize(expect: string): RequestHandler {
  return (q, r, next) => {
      if(q.headers.authorization === expect)
        next()
      else
        r.status(401).send({
          message: "Requires Authorization",
          error: "need_auth"
        });
    }
}