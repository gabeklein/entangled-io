import { Response } from 'express';

const CustomErrors = new Map<typeof Error, string>();

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

  for(const key of Object.getOwnPropertyNames(error))
    info[key] = (error as any)[key];

  const typeIdentifier =
    CustomErrors.get((error as any).constructor);

  if(typeIdentifier)
    info.uid = typeIdentifier;

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