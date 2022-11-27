export function log(message: string){
	console.log(message);
}

export function warn(message: string){
	console.warn(message); 
}

export function logFailedReload(err: Error, hot: any){
	const status = hot && hot.status() || "fail";

	if(["abort", "fail"].includes(status)){
		warn("[HMR] Cannot apply update.");
		warn("[HMR] " + formatError((err as any)));
		warn("[HMR] You need to restart the application!");
		return;
	}

	warn("[HMR] Update failed: " + ((err as any).stack || (err as any).message));
}

export function logApplyResult(
	updatedModules: string[],
	renewedModules: string[]){

	const unacceptedModules = updatedModules.filter((moduleId: string) => {
		return renewedModules && !renewedModules.includes(moduleId);
	});

	if(unacceptedModules.length > 0){
		warn(
			"[HMR] The following modules couldn't be hot updated: (They would need a full reload!)"
		);
		unacceptedModules.forEach((moduleId: string) => {
			warn("[HMR]  - " + moduleId);
		});
	}

	if(!renewedModules || renewedModules.length === 0){
		log("[HMR] Nothing hot updated.");
		return;
	}

	log("[HMR] Updated modules:");

	renewedModules.forEach((moduleId: string) => {
		if(typeof moduleId === "string" && moduleId.indexOf("!") !== -1){
			const parts = moduleId.split("!");

			console.groupCollapsed("[HMR]  - " + parts.pop());
			log("[HMR]  - " + moduleId);
			console.groupEnd();
			return;
		}
		log("[HMR]  - " + moduleId);
	});

	const numberIds = renewedModules.every((moduleId: string) => {
		return typeof moduleId === "number";
	});

	if(numberIds)
		log(
			'[HMR] Consider using the optimization.moduleIds: "named" for module names.'
		);
};

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