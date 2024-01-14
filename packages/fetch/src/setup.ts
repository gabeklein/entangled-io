import { stringify, unpack } from '@entangled/interface';

import { newCustomError, notAsyncError, throwRemoteError } from './errors';

export function traverse(target: any, endpoint: string, path = "") {
  if(Array.isArray(target)){
    switch(target[0]){
      case 0:
        return notAsyncError(path);

      case 1:
        return newHandler(path, endpoint);

      case 2:
        return newCustomError(path);

      default:
        throw new Error(`Unknown entity type ${target[0]}`);
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
  path: string, endpoint: string){

  return async (...args: RestArgument[]) => {
    endpoint = endpoint.replace(/\/$/, "");
    path = path.replace(/^\//, "");

    const url = (endpoint + "/" + path).toLowerCase();

    const init = {
      headers,
      method: "POST",
      cache: "no-cache",
      body: stringify(args)
    } as const;
  
    const response = await fetch(url, init)
    const output = await response.json().then(unpack);
    const { status } = response;
  
    if(status >= 300)
      throw throwRemoteError(output);
    else if("response" in output)
      return output.response;
    else
      return output;
  };
}