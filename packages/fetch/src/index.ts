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

function create(schema: {}, endpoint: string){
  return traverse(schema, endpoint);
}

function traverse(target: any, endpoint: string, path = "") {
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
  const h = (...args: any[]) => fetchJson(path, args, endpoint);
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

async function fetchJson(
  url: string,
  args: RestArgument[],
  endpoint: string){
  // const post = args.length === 1 && typeof args[0] === "object";

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
}

export = create;