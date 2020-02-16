export function define(schema: {}){
  return traverse(schema, "/")
}

function traverse(target: any, path: string) {
  if(typeof target == "object"){
    const { default: root, ...api } = target;
    const route: any = root ? newHandler(path) : {};
    for(const key in api)
      route[key] = traverse(api[key], path + "/" + key)
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
    body
  } as const;

  return fetch(url, init).then((response: Response) => {
    const { status } = response;

    const output = response.json().then(obj => {
      Object.defineProperty(obj, "statusCode", { value: status })
      return obj;
    })

    if(status >= 300)
      throw output;
    else
      return output;
  })
}