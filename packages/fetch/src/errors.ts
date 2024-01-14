import { unpack } from "@entangled/interface";

const CUSTOM_ERROR = new Map<string, typeof HttpError>();

export function notAsyncError(path: string){
  return () => {
    throw new Error(`${path} does not lead to an async function. It cannot be called by client.`);
  }
}

export function newCustomError(path: string){
  const match = /\/(\w+)$/.exec(path);
  const uid = "/" + path.toLowerCase();

  if(!match)
    throw new Error("");

  const factory = new Function(
    "BaseError",
    `return class ${match[1]} extends BaseError {}`
  );

  const ErrorType: typeof HttpError = factory(HttpError);

  CUSTOM_ERROR.set(uid, ErrorType);

  return ErrorType;
}

export function throwRemoteError(data: any){
  const uid = data.error && data.error.toLowerCase();

  const Type: typeof HttpError =
    CUSTOM_ERROR.get(uid) || HttpError;

  const error: any = new Type(data.message);

  for(const key in data)
    if(key == "stack"){
      // const remoteLines = data.stack.map((x: string) => "    " + x);]
      error.stack = error.stack.split("\n").splice(1, 2).join("\n");
    }
    else
      (error as any)[key] = unpack(data[key]);

  return error;
}

export class HttpError extends Error {
  code: number = 500;
}