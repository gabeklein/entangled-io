export namespace Entangled {
  type HavingDefault = { default: Fn };

  type Fn = (...args: any[]) => any;

  type ArgumentsOf<T> = T extends (... args: infer U ) => infer R ? U : never;

  type Item<T> = 
    T extends Fn ? RemoteCallable<T> :
    T extends {} ? API<T> : 
    never;

  export type RemoteCallable<F extends Fn> = {
    (...args: ArgumentsOf<F>): Promise<ReturnType<F>>;
    path: string;
  }

  export type Namespace<T extends {}> = { readonly [P in keyof T]: Item<T[P]> };

  export type CallableNamespace<T extends HavingDefault> = 
    RemoteCallable<T["default"]> & 
    Namespace<Omit<T, "default">>

  export type DefineRoute = 
    | Fn 
    | { [k: string]: DefineRoute }

  /*Entangled.API*/
  export type API<T extends {}> = 
    T extends HavingDefault ? CallableNamespace<T> : Namespace<T>
}