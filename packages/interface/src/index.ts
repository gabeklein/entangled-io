export { default } from "./namespace";

const shouldParse = /^\u200B!(\w+):(.*)$/;

type Rehydrate = {
  [type: string]: (body: string) => any;
}

const BASE_REHYDRATE = {
  "Date": (input: string) => new Date(input)
}

export function parse(json: string){
  return unpack(JSON.parse(json));
}

export function stringify(data: any){
  return JSON.stringify(pack(data));
}

export function pack(data: any): any {
  if(data instanceof Date)
    return `\u200B!Date:${data.getTime()}`;
    
  if(typeof data == "function")
    return undefined;

  if(data === null)
    return null;

  if(Array.isArray(data))
    return data.map(pack);

  if(typeof data == "object"){
    const map = {} as typeof data;
    for(const k in data)
      map[k] = pack(data[k])
    return map;
  }

  return data;
}

export function unpack(data: any, handle?: Rehydrate): any {
  handle = {
    ...BASE_REHYDRATE,
    ...handle
  }

  if(typeof data == "string")
    return rehydrate(data, handle);

  else if(Array.isArray(data))
    return data.map(x => unpack(x, handle));

  else if(typeof data == "object")
    for(const k in data)  
      data[k] = unpack(data[k], handle);
      
  return data;
}

function rehydrate(data: string, handle: Rehydrate){
  const match = shouldParse.exec(data);

  if(!match)
    throw new Error(`Could not unpack data "${data}"`);

  const [_, key, body] = match;

  if(!handle[key])
    throw new Error(
      `Tried to unpack data but no handler for "${key}" provided by client.`
    );

  return handle[key](body);
}