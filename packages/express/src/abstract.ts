import { RequestHandler, Response } from 'express';

import { Internal, RestError, BadInput } from './errors';
import { createContext } from './async_hook';

const { DEBUG_ENDPOINTS } = process.env;

const SerializeError = Internal("Resource returned data which could not be serialized", "serialize_error");

function format(data: any): any {
  if(data instanceof Date)
    return `${Math.floor(data.getTime() / 1000)}Z`
    
  if(typeof data == "function")
    return undefined;

  if(data === null)
    return null;

  if(Array.isArray(data))
    return data.map(format);

  if(typeof data == "object"){
    const map = {} as typeof data;
    for(const k in data)
      map[k] = format(data[k])
    return map;
  }

  return data;
}

function parse(data: any): any {
  let match;
  if(typeof data == "string" && (match = /^(\d+)Z$/.exec(data)))
    return new Date(Number(match[1]) * 1000);

  if(Array.isArray(data))
    return data.map(parse);

  if(typeof data == "object")
    for(const k in data)
      data[k] = parse(data[k])
      
  return data;
}

export function abstract(handler: Function): RequestHandler {
  return async (request, response) => {
    try {
      let { body } = request;

      if(!body)
        body = []
      else if(Array.isArray(body) ==  false)
        throw BadInput("POST body must be an array")

      body = parse(body);

      createContext({ req: request, res: response });
      const exec = handler.apply(null, body) as any;
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
        if(DEBUG_ENDPOINTS)
          debugger
          
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
  
  if(content == null || typeof content !== "object")
    content = { response: content };
    
  response.json(format(content))
}

export const handle404: RequestHandler = 
  (q, r) => r.status(404).json({
    message: `Cannot ${q.method} ${q.url}`
  })
