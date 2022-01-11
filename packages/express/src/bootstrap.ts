import { Service } from "./interface";

export default function start(schema: any){
  const { listen } = require("simple-argv");
  const service = new Service(schema);

  if(listen){
    const port =
      typeof listen == "number" ? listen :
      Number(process.env.PORT) || 8080;

    service.listen(port, () => {
      console.log(`Service is running on port ${port}.`);
    })
  }

  return service;
}