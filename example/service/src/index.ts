import Service from '@entangled/express';

import * as Greetings from "./hello";

const API = new Service({ Greetings });

API.listen(8080, () => {
  console.log("Listening on port 8080")
});

export = API.Interface;