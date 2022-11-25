const FUNCTION_REGISTER = new Map<string, Map<string, Function>>();

export function webpackRequireCallback(options: any){
  const isEntryFile = options.module.parents.length === 0;
  const { module, id } = options;
  const { hot } = module as any;

  if(!hot)
    return;

  let exports = {};
  
  Object.defineProperty(module, "exports", {
    configurable: true,
    get: () => {
      if(Object.keys(exports).length){
        exports = bootstrap(id, exports, isEntryFile);
        Object.defineProperty(module, "exports", {
          value: exports
        });
  
        hot.accept((error: Error, options: any) => {
          console.warn(`Loading module '${id}' failed due to error. Refresh module to try again.`);
        });
      }
      
      return exports;
    }
  });
}

function bootstrap(id: string, exports: any, entry: boolean){
  let register = FUNCTION_REGISTER.get(id);

  if(!register)
    FUNCTION_REGISTER.set(id, register = new Map());

  const proxyExports = {};

  for(const name in exports){
    const value = exports[name];

    if(typeof value == "function"){
      const proxy = (...args: any[]) => (
        register!.get(name)!.apply(null, args)
      );

      register.set(name, value);
      Object.defineProperty(proxyExports, name, {
        enumerable: true,
        get: () => proxy
      })
    }
    else
      Object.defineProperty(proxyExports, name, {
        enumerable: true,
        get: () => value
      })
  }

  console.log(`Loaded module: ${id}`);

  return proxyExports;
}