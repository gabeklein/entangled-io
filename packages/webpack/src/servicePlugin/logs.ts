export function logFailedReload(err: Error, hot: any){
	const status = hot && hot.status() || "fail";

	if(["abort", "fail"].includes(status)){
		console.warn("[HMR] Cannot apply update.");
		console.warn("[HMR] " + formatError((err as any)));
		console.warn("[HMR] You need to restart the application!");
		return;
	}
	console.warn("[HMR] Update failed: " + ((err as any).stack || (err as any).message));
}

export function logApplyResult(
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