const FUNCTION_REGISTER = new Map<string, Map<string, Function>>();

module.exports = function webpackRequire(options: any){
  // const isEntryFile = options.module.parents.length === 0;
  const { module, id } = options;
  const { hot } = module as any;

  if(!hot)
    return;

  const bootstrap = () => {
    module.exports = proxy(id, module.exports);
    console.log(`Loaded module: ${id}`);

    // debugger
  }

  Object.defineProperty(module, "loaded", {
    configurable: true,
    get(){ return false },
    set(){
      Object.defineProperty(module, "loaded", { value: true });
      bootstrap();
    }
  })
  
  hot.accept((error: Error, mod: any) => {
    console.warn(`Loading module '${id}' failed due to error. Refresh module to try again.`);
    // debugger
    // hot.decline();
  });
}

function proxy(id: string, exports: any){
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
  }

  return proxyExports;
}