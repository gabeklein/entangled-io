export class RestError extends Error {
  constructor(
    public statusCode: number,
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