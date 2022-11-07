import { Response } from 'express';

import { pack } from './strategy';

const CustomErrors = new Map<typeof Error, string>();
const getStackTraceEntries =   /^    at (.+)\n?/gm;

function parseStackTrace(from: string){
  let stack = [] as string[];
  let match: string[] | null;
  
  while(match = getStackTraceEntries.exec(from)){
    const at = match[1];

    if(/node:async_hooks/.test(at))
      break;
    else
      stack.push(match[1]);
  }
  
  return stack.slice(0, -2);
}

export function setCustomError(
  Type: typeof Error,
  path: string){

  CustomErrors.set(Type, path);
}

export function emitCustomError(
  error: Error | RestError, response: Response){

  const statusCode =
    "status" in error ? error.status : 500;

  const info = {} as any;

  for(const key of Object.getOwnPropertyNames(error)){
    let value = (error as any)[key];

    if(key == "stack")
      info[key] = parseStackTrace(value);
    else
      info[key] = pack(value);
  }

  const typeIdentifier =
    CustomErrors.get((error as any).constructor);

  if(typeIdentifier)
    info.error = typeIdentifier;

  response.status(statusCode);
  response.json(info);
}

export class RestError extends Error {
  constructor(
    public status: number,
    message?: string, 
    public shortCode?: string){

    super(message);
  }
}

export function Forbidden(message?: string, error?: string) {
  return new RestError(403, message, error)
}

export function NotFound(message?: string, error?: string) {
  return new RestError(404, message, error)
}

export function Internal(message?: string, error?: string) {
  return new RestError(500, message, error)
}

export function BadInput(message?: string, error?: string) {
  return new RestError(400, message, error)
}