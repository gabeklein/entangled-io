import { Request, Response } from "express";
import asyncHooks from "async_hooks";

export type ExpressExec = { req: Request, res: Response };

const expressContextMap = new Map<number, ExpressExec>();

asyncHooks.createHook({ init, destroy }).enable();

function init(asyncId: number, type: any, triggerAsyncId: number){
  const parent = expressContextMap.get(triggerAsyncId);

  if(parent)
    expressContextMap.set(asyncId, parent);   
}

function destroy(asyncId: number){
  expressContextMap.delete(asyncId);
}

export function createContext(context: ExpressExec){
  const asyncId = asyncHooks.executionAsyncId();
  expressContextMap.set(asyncId, context);
}

export function getContext(){
  const asyncId = asyncHooks.executionAsyncId();
  const context = expressContextMap.get(asyncId);

  if(!context)
    throw new Error("Context not found");

  return context;
}