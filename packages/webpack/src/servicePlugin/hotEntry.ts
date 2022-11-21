declare const __webpack_modules__: any;
declare const __webpack_module_cache__: any;

if("hot" in module){
  console.log("[HMR] Hot reload is active.");
  process.on("message", reloadModules);
}
else 
  throw new Error("[HMR] Hot Module Replacement is disabled.");

async function reloadModules(chunk: string){
  const { hot } = module as any;
  const status = hot.status();

  if(status !== "idle"){
    console.warn("[HMR] Got signal but currently in " + status + " state.");
    console.warn("[HMR] Need to be in idle state to start hot update.");
    return;
  }

  try {
    const modules = evaluate(chunk);
    const updated = Object.keys(modules);

    for(const [id, factory] of Object.entries(modules)){
      const cached = __webpack_module_cache__[id];
      __webpack_modules__[id] = factory;

      if(cached){
        cached.hot.invalidate();

        //TODO: monkeypatch hot.check() instead.
        //This prevents this module from invalidating parents needlessly.
        cached.hot._selfInvalidated = false;
      }
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
    const status = hot.status();
    if(["abort", "fail"].includes(status)){
      console.warn("[HMR] Cannot apply update.");
      console.warn("[HMR] " + formatError((err as any)));
      console.warn("[HMR] You need to restart the application!");
      return;
    }
    console.warn("[HMR] Update failed: " + ((err as any).stack || (err as any).message));
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

function formatError(err: Error){
	const message = err.message;
	const stack = err.stack;

	if(!stack)
		return message;
	else if(stack.indexOf(message) < 0)
		return message + "\n" + stack;
	else
		return stack;
};

function logApplyResult(
	updatedModules: string[],
	renewedModules: string[]){

	const unacceptedModules = updatedModules.filter((moduleId: string) => {
		return renewedModules && !renewedModules.includes(moduleId);
	});

	if(unacceptedModules.length > 0){
		console.warn(
			"[HMR] The following modules couldn't be hot updated: (They would need a full reload!)"
		);
		unacceptedModules.forEach((moduleId: string) => {
			console.warn("[HMR]  - " + moduleId);
		});
	}

	if(!renewedModules || renewedModules.length === 0){
		console.log("[HMR] Nothing hot updated.");
		return;
	}

	console.log("[HMR] Updated modules:");

	renewedModules.forEach((moduleId: string) => {
		if(typeof moduleId === "string" && moduleId.indexOf("!") !== -1){
			const parts = moduleId.split("!");

			console.groupCollapsed("[HMR]  - " + parts.pop());
			console.log("[HMR]  - " + moduleId);
			console.groupEnd();
			return;
		}
		console.log("[HMR]  - " + moduleId);
	});

	const numberIds = renewedModules.every((moduleId: string) => {
		return typeof moduleId === "number";
	});

	if(numberIds)
		console.log(
			'[HMR] Consider using the optimization.moduleIds: "named" for module names.'
		);
};