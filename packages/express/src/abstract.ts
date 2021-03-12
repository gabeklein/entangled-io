import { RequestHandler, Response } from 'express';

import { Internal, RestError, BadInput } from './errors';
import { createContext } from './async_hook';
import { format, parse } from './body';

const { DEBUG_ENDPOINTS } = process.env;

const SerializeError = Internal("Resource returned data which could not be serialized", "serialize_error");

export function abstract(
  handler: Function): RequestHandler {

  return async (request, response) => {
    try {
      let { body } = request;

      if(!body)
        body = []
      else if(Array.isArray(body) ==  false)
        throw BadInput("POST body must be an array")

      body = parse(body);

      createContext({ req: request, res: response });

      let output = await handler.apply(null, body);

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

function responder(
  response: Response,
  status: number,
  content: any){

  if(response.headersSent)
    return

  response.status(status)
  
  if(content == null || typeof content !== "object")
    content = { response: content };
    
  response.json(format(content))
}