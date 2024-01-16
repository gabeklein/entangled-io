import { pack, unpack } from '@entangled/interface';
import { RequestHandler } from 'express';

import { createContext } from './async_hook';
import { BadInput, emitCustomError, Internal } from './errors';

export function abstract(
  handler: Function): RequestHandler {

  return async (request, response) => {
    return createContext(
      { req: request, res: response },
      async () => {
        try {
          let { body } = request;
    
          if(!body)
            body = []
          else if(Array.isArray(body) ==  false)
            throw BadInput("POST body must be an array")
    
          body = unpack(body);
    
          let output = await handler.apply(null, body);

          try { 
            if(response.headersSent)
              return;

            response.status(200)

            if(output == null || typeof output !== "object")
              output = { response: output };
              
            response.json(pack(output));
          }
          catch(err){
            throw Internal(
              "Resource returned data which could not be serialized",
              "serialize_error"
            );
          }
        }
        catch(err){
          if(err instanceof Error)
            emitCustomError(err, response);
        } 
      }
    );
  }
}