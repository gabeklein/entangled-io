declare namespace Entangled {
  type HavingDefault = { default: Fn };

  type Fn = (...args: any[]) => any;

  type ErrorType = new (...args: any[]) => Error;

  type ArgumentsOf<T> = T extends (...args: infer U) => any ? U : never;
  type Promisable<T> = T extends Promise<any> ? T : Promise<T>

  export type Resources<E extends string, T extends {}> = { 
    readonly [P in keyof T]: Item<T[P]> 
  };

  export type Item<T> =
    T extends ErrorType ? T :
    T extends Fn ? RemoteCallable<T> :
    T extends HavingDefault ? CallableNamespace<T> :
    T extends {} ? Namespace<T> : 
    never;

  export interface RemoteCallable<F extends Fn> {
    (...args: ArgumentsOf<F>): Promisable<ReturnType<F>>
    path: string
  }

  export type Namespace<T extends {}> = { 
    readonly [P in keyof T]: Item<T[P]> 
  };

  export type CallableNamespace<T extends HavingDefault> = 
    & RemoteCallable<T["default"]> 
    & Namespace<Omit<T, "default">>

  export type Schema = { 
    [k: string]: Schema | ErrorType | Fn;
  }
}

export = Entangled;