import { Module, ParameterizedType } from '@entangled/interface';
import path from 'path';

import { RemoteModule } from '.';

export function generatePolyfill(
  module: RemoteModule,
  agent: string){

  const target = module.location!;
  const { output, cache: fileCache } = new Module(target);

  const potentialExports = [
    [null, output], 
    ...Object.entries(output)
  ];
  
  let computed;

  for(const [key, target] of potentialExports)
    if(target instanceof ParameterizedType){
      computed = target.params[1];
      if(typeof key == "string")
        computed = { [key]: computed }
      break;
    }
  
  const json = JSON.stringify(computed);
  const imaginaryFile = path.join(target, "entangled.js");
  const initContent = `module.exports = require("${agent}")(${json})`;

  return {
    file: imaginaryFile,
    content: initContent,
    source: fileCache
  }
}