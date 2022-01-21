import { Request, Response } from "express";
import { AsyncLocalStorage } from "async_hooks";

export type ExpressExec = {
  req: Request,
  res: Response
};

const expressContextMap = new Map<string, ExpressExec>();
const entangledContext = new AsyncLocalStorage();

export function createContext<T>(
  context: ExpressExec,
  handler: () => Promise<T>
): Promise<T> {
  const uuid = uniqueHash(Math.random(), 10);

  return entangledContext
    .run(uuid, () => {   
      expressContextMap.set(uuid, context);
      return handler();
    })
    .finally(() => {
      expressContextMap.delete(uuid);
    })
}

export function useContext(){
  const id = entangledContext.getStore();

  if(!id)
    throw new Error(
      "Context not found. Are you in-context of a request?"
    );

  const ctx = expressContextMap.get(id as string);

  if(!ctx)
    throw new Error(
      "Express context not found. This is an internal error."
    );

  return ctx;
}

export function requestID(){
  return uniqueHash(Math.random(), 10);
}

export function uniqueHash(
  str: string | number = "",
  length: number){

  const id = String(str);
  const m32 = Math.imul;
  const x = 0x85ebca6b, y = 0xc2b2ae35;
  let h1 = 0xdeadbeef, h2 = 0x41c6ce57;

  for(let i = 0, ch; i < id.length; i++){
    ch = id.charCodeAt(i);
    h1 = m32(h1 ^ ch, 0x9e3779b1);
    h2 = m32(h2 ^ ch, 0x5f356495);
  }

  h1 = m32(h1 ^ (h1>>>16), x) ^ m32(h2 ^ (h2>>>13), y);
  h2 = m32(h2 ^ (h2>>>16), x) ^ m32(h1 ^ (h1>>>13), y);

  const out = 0x100000000 * (0x1fffff & h2) + (h1>>>0);

  return out.toString(16).substring(0, length).toUpperCase();
}