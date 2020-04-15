import { Interface } from '@entangled/express';

import * as greetings from "./hello"

/**
 * This does something fun
 */
function echo(quote: string){
  console.log(quote)
  return quote;
}

const api = new Interface({ echo, greetings });

api.listen(8080, () => {
  console.log("Listening on port 8080")
});

export = api;