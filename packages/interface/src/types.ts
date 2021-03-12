export namespace Entangled {
  type HavingDefault = { default: Fn };

  type Fn = (...args: any[]) => any;

  type ArgumentsOf<T> = T extends (...args: infer U) => any ? U : never;
  type Promisable<T> = T extends Promise<any> ? T : Promise<T>
  
  export type Item<T> = 
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

  export type DefineRoutes = { 
    [k: string]: DefineRoutes | Fn;
  }
}

export class ParameterizedType {
  constructor(
    public modifier: any,
    public params: any[]
  ){}
}

export class TypeAlias {
  comment?: string;
}

export class InterfaceType {
  comment?: string;
}

export class ObjectLiteral {
  [ key: string ]: any
}