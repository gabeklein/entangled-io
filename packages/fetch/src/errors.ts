import { parse } from "./parse";

const CUSTOM_ERROR = new Map<string, typeof Error>();

export function newCustomError(path: string){
  const match = /\/(\w+)$/.exec(path);
  const uid = "/" + path.toLowerCase();

  if(!match)
    throw new Error("");

  const ErrorType: typeof Error = new Function(`
    return class ${match[1]} extends Error {}
  `)();

  CUSTOM_ERROR.set(uid, ErrorType);

  return ErrorType;
}

export function throwRemoteError(data: any){
  const uid = data.error.toLowerCase();

  const Type: typeof Error =
    CUSTOM_ERROR.get(uid) || Error;

  const error: any = new Type(data.message);

  for(const key in data)
    if(key == "stack"){
      // const remoteLines = data.stack.map((x: string) => "    " + x);]
      error.stack = error.stack.split("\n").splice(1, 2).join("\n");
    }
    else
      (error as any)[key] = parse(data[key]);

  return error;
}