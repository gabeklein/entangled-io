import { traverse } from './setup';

interface CreateOptions {
  endpoint?: string;
  namespace?: string;
}

function create(schema: {}, options: CreateOptions){
  let { endpoint, namespace = "" } = options || {};

  if(!endpoint)
    try {
      endpoint = process.env.ENDPOINT || "/"
    }
    catch(err){
      endpoint = "/";
    }
  
  return traverse(schema, endpoint, namespace);
}

export { HttpError } from "./errors";

export default create;