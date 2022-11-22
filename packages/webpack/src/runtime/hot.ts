import { logApplyResult, logFailedReload } from "./logs";

const FUNCTION_REGISTER = new Map<string, Map<string, Function>>();

module.exports = (webpackRequire: any) => {
  webpackRequire.i.push(webpackRequireCallback);
  addWebpackUpdateListener(webpackRequire);
}

function addWebpackUpdateListener(webpackRequire: any){
  const {
    m: moduleFactories,
    c: cache
  } = webpackRequire;

  process.on("message", applyHotReload);
  console.log("[HMR] Hot reload is active.");

  async function applyHotReload(chunk: string){
    let hot: any;

    try {
      const modules = evaluate(chunk);
      const updated = Object.keys(modules);

      for(const [id, factory] of Object.entries(modules)){
        const cached = cache[id];
        moduleFactories[id] = factory;

        if(!cached){
          // TODO: handle newly created modules
          console.warn(`Module ${id} was updated but doesn't already exist. Ignoring.`)
          continue;
        }

        hot = cached.hot;
        hot.invalidate();

        //TODO: monkeypatch hot.check() instead.
        //This prevents this module from invalidating parents.
        hot._selfInvalidated = false;
      }

      const renewedModules = await hot.apply({
        ignoreUnaccepted: true,
        onUnaccepted(data: any){
          console.warn(
            "Ignored an update to unaccepted module " +
              data.chain.join(" -> ")
          );
        }
      });

      logApplyResult(updated, renewedModules);
    }
    catch(err){
      logFailedReload(err as Error, hot);
    }
  }
}

function webpackRequireCallback(options: any){
  // const isEntryFile = options.module.parents.length === 0;
  const { module, id } = options;
  const { hot } = module as any;

  if(!hot)
    return;

  let exports = {};
  
  Object.defineProperty(module, "exports", {
    configurable: true,
    get: () => {
      if(Object.keys(exports).length){
        exports = bootstrap(id, exports);
        Object.defineProperty(module, "exports", {
          value: exports
        })
      }
      
      return exports;
    }
  })
  
  hot.accept((error: Error, mod: any) => {
    console.warn(`Loading module '${id}' failed due to error. Refresh module to try again.`);
    // debugger
    // hot.decline();
  });
}

function bootstrap(id: string, exports: any){
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

  console.log(`Loaded module: ${id}`);

  return proxyExports;
}

function evaluate(code: string){
  const exports = {} as {
    id: string,
    modules: {
      [key: string]: (m: any, e: any, r: any) => void;
    }
  };

  new Function("exports", code)(exports);

  return exports.modules;
}