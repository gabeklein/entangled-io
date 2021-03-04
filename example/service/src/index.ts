import { Interface } from '@entangled/express';

import * as Greetings from "./hello"

/**
 * This does something fun
 */
function echo(quote: string){
  console.log(quote)
  return quote;
}

const API = new Interface({ echo, Greetings });

API.listen(8080, () => {
  console.log("Listening on port 8080")
});

export = API;