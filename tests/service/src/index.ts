import { serve, listen } from '@entangled/express';

import * as greetings from "./hello-service"

/**
 * This does sometthing fun
 */
function something(name: string){
  return 5
}

const api = serve({ greetings, something });

listen(api, 8080);

export = api;