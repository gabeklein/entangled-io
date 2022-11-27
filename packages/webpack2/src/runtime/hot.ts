import { log, logApplyResult, logFailedReload, warn } from './logs';
import { webpackRequireCallback } from './require';

module.exports = (webpackRequire: any) => {
  webpackRequire.i.push(webpackRequireCallback);
  
  process.on("message", chunk => {
    applyHotReload(
      evaluate(chunk),
      webpackRequire.m,
      webpackRequire.c
    );
  });

  log("[HMR] Hot reload is active.");
}

async function applyHotReload(
  update: any,
  modules: any,
  cache: any){

  const updated = Object.keys(update);
  let hot: any;

  try {
    for(const id of updated){
      const cached = cache[id];
      modules[id] = update[id];

      if(!cached){
        // TODO: handle newly created modules
        warn(`Module ${id} was updated but doesn't already exist. Ignoring.`);
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
        warn(
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