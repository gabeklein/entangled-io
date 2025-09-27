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
          let { body = [], query } = request;

          if(request.method === 'GET' || request.method === 'DELETE')
            body = [query]

          if(Array.isArray(body))
            body = unpack(body);
          else
            throw BadInput("POST body must be an array");
  
          let output = await handler(...body);

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
          emitCustomError(response, err);
        }
        finally {
          if(response.headersSent || response.getHeader('Content-Type') == 'text/event-stream')
            return;

          response.end();
        }
      }
    );
  }
}