const shouldParse = /^\0(\w+)::(.*)$/;

export class Interface {
  pack(data: any){
    if(data instanceof Date)
      return "\0Date::" + data.getTime();

    if(data instanceof ArrayBuffer)
      data = new Uint8Array(data);

    if(data instanceof Uint8Array){
      const binaryString = Array.from(data, byte => String.fromCharCode(byte)).join('');
      return `\0Buffer::` + btoa(binaryString);
    }

    if(data instanceof Array)
      return data.map(this.pack, this);

    if(typeof data == "object"){
      const map = {} as typeof data;
      for(const k in data)
        map[k] = this.pack(data[k])
      return map;
    }

    return data;
  }

  unpack(data: any){
    if(Array.isArray(data))
      return data.map(x => this.unpack(x));
    
    if(typeof data == "object"){
      for(const k in data)  
        data[k] = this.unpack(data[k]);

      return data;
    }

    if(typeof data == "string"){
      const match = shouldParse.exec(data);

      if(match)
        return this.parse(...match.slice(1) as [string, string]);

      return data;
    }

    throw new Error("unpack only works on strings or arrays/objects of strings");
  }

  parse(type: string, body: string){
    if(type === "Date")
      return new Date(Number(body));

    if(type === "Buffer"){
      try {
        return Buffer.from(body, 'base64');
      } catch {
        const binaryString = atob(body);
        const bytes = new Uint8Array(binaryString.length);
        for (let i = 0; i < binaryString.length; i++) {
          bytes[i] = binaryString.charCodeAt(i);
        }
        return bytes.buffer;
      }
    }

    throw new Error(
      `Tried to unpack data but no handler for "${type}" provided by client.`
    );
  }
}

export { default } from "./namespace";
export { CallableTransport } from './callback';