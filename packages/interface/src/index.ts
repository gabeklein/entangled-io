export { default } from "./namespace";

const shouldParse = /^!(\w+)::(.*)$/;

type Rehydrate = {
  [type: string]: (body: string) => any;
}

const BASE_REHYDRATE = {
  "Date": (input: string) => new Date(Number(input)),
  "Buffer": (input: string) => {
    try {
      return Buffer.from(input, 'base64');
    } catch {
      const binaryString = atob(input);
      const bytes = new Uint8Array(binaryString.length);
      for (let i = 0; i < binaryString.length; i++) {
        bytes[i] = binaryString.charCodeAt(i);
      }
      return bytes.buffer;
    }
  }
}

export function pack(data: any): any {
  if(data instanceof Date)
    return "!Date::" + data.getTime();
    
  if(data instanceof ArrayBuffer) {
    const bytes = new Uint8Array(data);
    const binaryString = Array.from(bytes, byte => String.fromCharCode(byte)).join('');
    return `!Buffer::${btoa(binaryString)}`;
  }
    
  if(typeof data == "function")
    return "!Callback::" + registerCallback(data);

  if(data === null)
    return null;

  if(data instanceof Array)
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
  if(Array.isArray(data))
    return data.map(x => unpack(x, handle));
  
  if(typeof data == "object"){
    for(const k in data)  
      data[k] = unpack(data[k], handle);

    return data;
  }

  if(typeof data != "string")
    throw new Error("unpack only works on strings or arrays/objects of strings");

  const match = shouldParse.exec(data);

  if(!match)
    return data;
  
  handle = { ...BASE_REHYDRATE, ...handle };

  const [key, value] = match.slice(1);

  if(handle[key])
    return handle[key](value);

  throw new Error(
    `Tried to unpack data but no handler for "${key}" provided by client.`
  );
}