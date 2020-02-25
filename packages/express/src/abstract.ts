import { RequestHandler, Response } from 'express';

import { Internal, RestError, BadInput } from './errors';

const SerializeError = Internal("Resource returned data which could not be serialized", "serialize_error");

function stringifyDates(data: any): any {
  if(data instanceof Date)
    return `${Math.floor(data.getTime() / 1000)}Z`

  if(Array.isArray(data))
    return data.map(stringifyDates);

  if(typeof data == "object"){
    const map = {} as typeof data;
    for(const k in data)
      map[k] = stringifyDates(data[k])
    return map;
  }
  else
    data = String(data);

  return data;
}

function parseDates(data: any): any {
  let match;
  if(typeof data == "string" && (match = /^(\d+)Z$/.exec(data)))
    return new Date(Number(match[1]) * 1000);

  if(Array.isArray(data))
    return data.map(parseDates);

  if(typeof data == "object")
    for(const k in data)
      data[k] = parseDates(data[k])
      
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

      body = parseDates(body);

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
  
  response.json(stringifyDates(content))
}

export const handle404: RequestHandler = 
  (q, r) => r.status(404).json({
    message: `Cannot ${q.method} ${q.url}`
  })
