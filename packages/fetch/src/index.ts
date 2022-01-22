import { traverse } from './setup';

const DEFAULT_ENDPOINT = process.env.ENDPOINT || "/";

interface CreateOptions {
  endpoint?: string;
  namespace?: string;
}

function create(schema: {}, options: CreateOptions){
  const {
    endpoint = DEFAULT_ENDPOINT,
    namespace = ""
  } = options || {};
  
  return traverse(schema, endpoint, namespace);
}

export = create;