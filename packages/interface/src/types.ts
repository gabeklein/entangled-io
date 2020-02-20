export namespace Entangled {
  type HavingDefault = { default: Fn };

  type Fn = (...args: any[]) => any;
  type AsyncFn = (...args: any[]) => Promise<any>;

  type ArgumentsOf<T> = T extends (... args: infer U ) => infer R ? U: never;
  type RemoteSync<F extends Fn> = (...args: ArgumentsOf<F>) => Promise<ReturnType<F>>

  type Item<T> = 
    T extends AsyncFn ? T :
    T extends Fn ? RemoteSync<T> :
    T extends {} ? API<T> : 
    never;

  export type Namespace<T extends {}> = { readonly [P in keyof T]: Item<T[P]> };

  export type CallableNamespace<T extends HavingDefault> = 
    RemoteSync<T["default"]> & 
    Namespace<Omit<T, "default">>

  export type DefineRoute = 
    | Fn 
    | { [k: string]: DefineRoute }

  /*Entangled.API*/
  export type API<T extends {}> = 
    T extends HavingDefault ? CallableNamespace<T> : Namespace<T>
}