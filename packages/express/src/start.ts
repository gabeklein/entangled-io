import { Service } from "./interface";

const PORT = process.env.PORT;

export default function start(schema: any, options: any){
  const { port = PORT } = options || {};

  return new Service(schema).listen(port, () => {
    console.log(`Service agent is listening on port ${port}.`)
  });
}