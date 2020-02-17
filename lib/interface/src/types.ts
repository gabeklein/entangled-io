export namespace Entangled {
  type Parameter = 
    | string
    | number
    | boolean
    | Date

  type Data = 
    | Parameter
    | { [ key: string ]: Data }

  type GetFunction = (...params: any[]) => any;
  type PostFunction = (data: Data) => any;
  
  type IOF = GetFunction | PostFunction;
  type HavingDefault = { default: IOF };

  type ArgumentsOf<T> = T extends (... args: infer U ) => infer R ? U: never;
  type RemoteCallable<F extends IOF> = (...args: ArgumentsOf<F>) => Promise<ReturnType<F>>

  type Item<T> = 
    T extends Function ? 
      T extends IOF ? 
        RemoteCallable<T> :
        never :
    T extends {} ? API<T> : 
    never;

  export type Namespace<T extends {}> = { [P in keyof T]: Item<T[P]> };

  export type CallableNamespace<T extends HavingDefault> = 
    RemoteCallable<T["default"]> & 
    Namespace<Omit<T, "default">>

  export type DefineRoute = 
    | IOF 
    | { [k: string]: DefineRoute }

  /*Entangled.API*/
  export type API<T extends {}> = 
    T extends HavingDefault ? CallableNamespace<T> : Namespace<T>
}