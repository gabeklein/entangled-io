export { default } from "./namespace";

export function parse(json: string){
  return unpack(JSON.parse(json));
}

export function stringify(data: any){
  return JSON.stringify(pack(data));
}

export function pack(data: any): any {
  if(data instanceof Date)
    return `${Math.floor(data.getTime() / 1000)}Z`
    
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

export function unpack(data: any): any {
  if(typeof data == "string")
    return dateString(data) || data;

  if(Array.isArray(data))
    return data.map(unpack);

  if(typeof data == "object")
    for(const k in data)  
      data[k] = unpack(data[k])
      
  return data;
}

function dateString(data: string){
  let match = /^(\d+)Z$/.exec(data);

  if(!match)
    return;

  const ms = Number(match[1]);
  return new Date(ms * 1000);
}