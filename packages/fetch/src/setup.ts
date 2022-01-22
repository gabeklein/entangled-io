import { format, parse } from "./parse";

export function traverse(target: any, endpoint: string, path = "") {
  if(typeof target == "object"){
    const { default: root, ...api } = target;
    const route: any = root ? newHandler(path, endpoint) : {};

    for(const key in api)
      route[key] = traverse(api[key], endpoint, path + "/" + key);

    return route;
  }
  else
    return newHandler(path, endpoint);
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
    url = (endpoint + url).toLowerCase();
  
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
      throw output;
    else if("response" in output)
      return output.response;
    else
      return output;
  };
}