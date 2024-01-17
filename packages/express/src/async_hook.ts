import { Request, Response } from "express";
import { AsyncLocalStorage } from "async_hooks";

export type ExpressExec = {
  req: Request,
  res: Response
};

const expressContextMap = new Map<string, ExpressExec>();
const entangledContext = new AsyncLocalStorage();

export async function createContext<T>(
  context: ExpressExec,
  handler: () => Promise<T>
): Promise<T> {
  const key = uid();

  return entangledContext
    .run(key, () => {   
      expressContextMap.set(key, context);
      return handler();
    })
    .finally(() => {
      expressContextMap.delete(key);
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

export function uid(){
  return (Math.random() * 0.722 + 0.278).toString(36).substring(2, 8).toUpperCase();
}