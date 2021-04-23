import { Module, ParameterizedType } from '@entangled/interface';
import path from 'path';

export function generatePolyfill(
  target: string,
  agent: string){

  const { output, cache: fileCache } = new Module(target);

  const potentialExports = [
    [null, output], 
    ...Object.entries(output)
  ];
  
  let computed;
  let endpoint;

  for(const [key, target] of potentialExports)
    if(target instanceof ParameterizedType){
      [endpoint, computed] = target.params;
      
      if(typeof key == "string")
        computed = { [key]: computed }

      if(/^[/A-Z]+$/.test(endpoint))
        endpoint = `process.env.${endpoint}`;

      break;
    }
  
  const json = JSON.stringify(computed);
  const imaginaryFile = path.join(target, "entangled.js");
  const initContent = `module.exports = require("${agent}")(${json}, ${endpoint})`;

  return {
    file: imaginaryFile,
    content: initContent,
    source: fileCache
  }
}