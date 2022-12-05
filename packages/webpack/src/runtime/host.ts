import { WebpackExecOptions } from "./require";

const REGISTER = new Map<string, Function>();
const LOOKUP = new WeakMap<Function, string>();

export function proxy(uid: string, value?: any){
  if(LOOKUP.has(value))
    return value;

  REGISTER.set(uid, value);

  if(typeof value == "function"){
    value = function(){
      return REGISTER.get(uid)!.apply(null, arguments);
    }

    LOOKUP.set(value, uid);
  }

  return value;
}

export function entry(
  this: WebpackExecOptions,
  exports: any) {

  const routes = new Set<string>();
  const register = (value: any) => {
    if(typeof value == "function")
      routes.add(LOOKUP.get(value)!);
    else if(typeof value == "object")
      Object.values(value).forEach(register);
  }

  register(exports);
}