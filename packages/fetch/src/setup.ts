import { format, parse } from "./parse";

export function traverse(target: any, endpoint: string, path = "") {
  if(Array.isArray(target)){
    switch(target[0]){
      case 0:
        return () => {
          throw new Error(`${path} does not lead to an async function. It cannot be called by client.`);
        }

      case 1:
        return newHandler(path, endpoint);

      case 2:
        return newCustomError(path);

      default:
        throw new Error(`Unknown entity type ${target[0]}`)
    }
  }

  if(typeof target == "object"){
    const { default: root, ...api } = target;
    const route: any = root ? newHandler(path, endpoint) : {};

    for(const key in api)
      route[key] = traverse(api[key], endpoint, path + "/" + key);

    return route;
  }
}

const CUSTOM_ERROR = new Map<string, typeof Error>();

function newCustomError(path: string){
  const match = /\/(\w+)$/.exec(path);
  const uid = "/" + path.toLowerCase();

  if(!match)
    throw new Error("");

  const ErrorType: typeof Error = new Function(`
    return class ${match[1]} extends Error {}
  `)();

  CUSTOM_ERROR.set(uid, ErrorType);

  return ErrorType;
}

function throwRemoteError(data: any){
  const uid = data.error.toLowerCase();

  const Type: typeof Error =
    CUSTOM_ERROR.get(uid) || Error;

  const error: any = new Type(data.message);

  for(const key in data)
    if(key == "stack"){
      // const remoteLines = data.stack.map((x: string) => "    " + x);]
      error.stack = error.stack.split("\n").splice(1, 2).join("\n");
    }
    else
      (error as any)[key] = data[key];

  return error;
}

function newHandler(path: string, endpoint: string){
  const handler = jsonHandler(path, endpoint);
  const base = /\/?(\w+)$/.exec(path);

  if(base && base[1])
    Object.defineProperty(handler, "name", {
      value: base[1]
    });

  return handler;
}

const headers = {
  ['Content-Type']: 'application/json',
  ['Accept']: 'application/json'
}

type RestArgument =
  | string
  | boolean
  | number
  | Date

function jsonHandler(
  url: string, endpoint: string){

  return async (...args: RestArgument[]) => {
    endpoint = endpoint.replace(/\/$/, "");
    url = (endpoint + "/" + url).toLowerCase();
  
    const body = format(args);
    const init = {
      headers,
      method: "POST",
      cache: "no-cache",
      body: JSON.stringify(body)
    } as const;
  
    const response = await fetch(url, init)
    const output = await response.json().then(parse);
    const { status } = response;
  
    if(status >= 300)
      throw throwRemoteError(output);
    else if("response" in output)
      return output.response;
    else
      return output;
  };
}