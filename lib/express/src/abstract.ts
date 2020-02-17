import { RequestHandler, Response } from 'express';

import { Internal, RestError, BadInput } from './errors';

const SerializeError = Internal("Resource returned data which could not be serialized", "serialize_error")

export function abstract(handler: Function): RequestHandler {
  return async (request, response) => {
    try {
      let { body } = request;

      if(!body)
        body = []
      else if(Array.isArray(body) ==  false)
        throw BadInput("POST body must be an array")

      const exec = handler(...body) as any;
      let output = exec instanceof Promise ? await exec : exec;

      try { 
        responder(response, 200, output);
      }
      catch(err){
        throw SerializeError;
      }
    }
    catch(err){
      if(err instanceof RestError)
        responder(response, err.statusCode, {
          error: err.shortCode,
          message: err.message
        });

      else {
        responder(response, 500, err);
        throw err;
      }
    }    
  }
}

function responder(response: Response, status: number, content: any){
  if(response.headersSent)
    return

  response.status(status)
  
  if(!content)
    response.json({ ok: true });
    
  else if(typeof content !== "object"){
    content = { response: content };
  }
  
  response.json(content)
}

export const handle404: RequestHandler = 
  (q, r) => r.status(404).json({
    message: `Cannot ${q.method} ${q.url}`
  })
