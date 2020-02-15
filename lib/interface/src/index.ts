import './parse'
import { Module } from './module';

export namespace Entangled {
  type TypeofFunction = (...args: any) => any;
  type ArgumentsOf<T> = T extends (... args: infer U ) => infer R ? U: never;
  type RemoteCallable<F extends TypeofFunction> = (...args: ArgumentsOf<F>) => Promise<ReturnType<F>>
  
  export type Template = { [name: string]: Resource }
  export type Resource = Function | Template

  /*Entangled.API*/
  export type API<T> = {
    [P in keyof T]: 
      T[P] extends TypeofFunction 
        ? RemoteCallable<T[P]> 
        : API<T[P]>
  }
}

export function collateTypes(root: string){
  return new Module(root);
}