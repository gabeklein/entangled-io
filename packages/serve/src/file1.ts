import { getName } from "./file2";

function hello() {
  return `hello from ${getName()}!`;
}

console.log("Hello " + getName())
console.log('file1 was loaded at:', Date.now());

// @ts-ignore
const { hot } = import.meta;
const __hmrRegistry = globalThis.__hmrRegistry || (globalThis.__hmrRegistry = new Map());
const __moduleId = "/Users/gabeklein/Expressive/entangle/packages/serve/src/file1.ts";

const __wrapped_hello = function(...args: any[]){
  return __hmrRegistry.get(`${__moduleId}:hello`).apply(this, args);
}
  
__hmrRegistry.set(`${__moduleId}:hello`, hello);

export { __wrapped_hello as hello };

if (hot) {
  console.log(`HMR enabled for ${__moduleId}`);

  hot.accept((mod) => {
    // Force module execution by accessing the exports
    console.log('HMR update received, new exports:', Object.keys(mod));

    __hmrRegistry.set(`${__moduleId}:hello`, mod.hello);

  });
} else

  console.log(`HMR not enabled for ${__moduleId}`);