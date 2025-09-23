import { i } from './interface';
import { RequestHandler } from 'express';

import { createContext } from './async_hook';
import { BadInput, emitCustomError, Internal } from './errors';

export function abstract(
  handler: Function): RequestHandler {

  return async (req, res) => {
    let { body } = req;

    return createContext(
      { req, res },
      async () => {
        try {
          if(!body)
            body = [];

          else if(Array.isArray(body) ==  false)
            throw BadInput("POST body must be an array")
    
          body = i.unpack(body);
    
          let output = await handler(...body);

          try { 
            if(res.headersSent)
              return;

            res.status(200)

            if(output == null || typeof output !== "object")
              output = { response: output };
              
            res.json(i.pack(output));
          }
          catch(err){
            throw Internal(
              "Resource returned data which could not be serialized",
              "serialize_error"
            );
          }
        }
        catch(err){
          emitCustomError(res, err);
        }
        finally {
          res.end();
        }
      }
    );
  }
}