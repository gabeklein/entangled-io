export function parse(data: any): any {
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