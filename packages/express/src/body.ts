export function parse(data: any): any {
  if(typeof data == "string")
    return dateString(data) || data;

  if(Array.isArray(data))
    return data.map(parse);

  if(typeof data == "object")
    for(const k in data)  
      data[k] = parse(data[k])
      
  return data;
}

export function format(data: any): any {
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

function dateString(data: string){
  let match = /^(\d+)Z$/.exec(data);

  if(!match)
    return;

  const ms = Number(match[1]);
  return new Date(ms * 1000);
}