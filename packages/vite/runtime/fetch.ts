import { stringify, unpack } from '@entangled/interface';

import { newCustomError, notAsyncError, throwRemoteError } from './errors';

type RestArgument = string | boolean | number | Date;

export interface FunctionOptions {
  async?: boolean;
}

export interface ConfigOptions {
  baseUrl?: string;
}

export default function configure(options: ConfigOptions){
  const BASE_URL = options.baseUrl?.replace(/\/$/, "") || "";

  return function factory(namespace: string){
    namespace = namespace.replace(/\/$/, "");
  
    function rpc(name: string, options: FunctionOptions = {}){
      if(options.async === false)
        return notAsyncError(name);
      
      const url = (BASE_URL + "/" + namespace + "/" + name).toLowerCase();
      const Module = {
        [name](...args: RestArgument[]){
          return postRequest(url, args);
        }
      }
      
      return Module[name];
    }
  
    function error(path: string){
      return newCustomError(namespace + "/" + path);
    }
        
    return Object.assign(rpc, { error });
  }
}

async function postRequest<B extends {}>(url: string, body: B){
  const response = await fetch(url, {
    method: "POST",
    cache: "no-cache",
    headers: {
      ['Content-Type']: 'application/json',
      ['Accept']: 'application/json'
    },
    body: stringify(body)
  });

  const output = await response.json().then(unpack);
  const { status } = response;

  if(status >= 300)
    throw throwRemoteError(output);
  else if("response" in output)
    return output.response;
  else
    return output;
}