let endpoint = "http://localhost:8080";

export function define(schema: {}){
  return traverse(schema)
}

function traverse(target: any, path = "") {
  if(typeof target == "object"){
    const { default: root, ...api } = target;
    const route: any = root ? newHandler(path + "/") : {};
    for(const key in api)
      route[key] = traverse(api[key], path + "/" + key);
    return route;
  }
  else
    return newHandler(path)
}

function newHandler(path: string){
  return (...args: any[]) => fetchJson(path, args)
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

function fetchJson(url: string, args: RestArgument[]){
  const post = args.length === 1 && typeof args[0] === "object";

  url = endpoint + url;

  const body = post 
    ? args[0] as any 
    : args.map(val => {
      if(val instanceof Date)
        return `Z${val.getTime() / 1000}`
      else 
        return String(val)
    })

  const init = {
    headers,
    method: "POST",
    cache: "no-cache",
    body: JSON.stringify(body)
  } as const;

  return fetch(url, init).then(async (response: Response) => {
    const { status } = response;

    const output = await response.json();

    if(status >= 300)
      throw output;
    else if(output.response)
      return output.response;
    else
      return output;
  })
}