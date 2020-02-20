import { serve, listen } from '@entangled/express';

import * as greetings from "./hello-service"

/**
 * This does something fun
 */
function echo(quote: string){
  console.log(quote)
  return quote;
}

const api = serve({ echo, greetings });

listen(api, 8080);

export = api;