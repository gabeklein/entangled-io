let endpoint = "http://localhost:8080";

try {
  const ep = process.env.ENDPOINT;
  if(ep) endpoint = ep;
}
catch(err){}

function format(data: any): any {
  if(data instanceof Date)
    return `${Math.floor(data.getTime() / 1000)}Z`
    
  if(typeof data == "function")
    return undefined;

  if(data === null)
    return null;

  if(Array.isArray(data))
    return data.map(format);

  if(typeof data == "object"){
    const map = {} as typeof data;
    for(const k in data)
      map[k] = format(data[k])
    return map;
  }

  return data;
}

function parse(data: any): any {
  let match;
  if(typeof data == "string" && (match = /^(\d+)Z$/.exec(data)))
    return new Date(Number(match[1]) * 1000);

  if(Array.isArray(data))
    return data.map(parse);

  if(typeof data == "object")
    for(const k in data)
      data[k] = parse(data[k])
      
  return data;
}

export function define(schema: {}){
  return traverse(schema)
}

function traverse(target: any, path = "") {
  if(typeof target == "object"){
    const { default: root, ...api } = target;
    const route: any = root ? newHandler(path) : {};
    for(const key in api)
      route[key] = traverse(api[key], path + "/" + key);
    return route;
  }
  else
    return newHandler(path)
}

function newHandler(path: string){
  const h = (...args: any[]) => fetchJson(path, args);
  const base = /\/?(\w+)$/.exec(path);
  if(base && base[1])
    Object.defineProperty(h, "name", { value: base[1] })
  h.path = path;
  return h;
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

async function fetchJson(url: string, args: RestArgument[]){
  // const post = args.length === 1 && typeof args[0] === "object";

  url = endpoint + url;

  const body = format(args);

  const init = {
    headers,
    method: "POST",
    cache: "no-cache",
    body: JSON.stringify(body)
  } as const;

  const response = await fetch(url, init)

  const { status } = response;
  const output = await response.json().then(parse);

  if(status >= 300)
    throw output;
  else if(output.response)
    return output.response;
  else
    return output;
}