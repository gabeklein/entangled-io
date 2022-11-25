import { logApplyResult, logFailedReload } from './logs';
import { webpackRequireCallback } from './require';

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