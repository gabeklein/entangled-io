import getWorkspace from 'find-yarn-workspace-root';
import { existsSync, lstatSync } from 'fs';
import { dirname, resolve } from 'path';

import { Parser } from './parse';
import { resolveMainTypes, tryParseWithBabel, tryReadFile } from './util';

export class Module {
  name?: string
  file: string;
  paths: string[];

  constructor(
    public root: string,
    private cache = new Map<string, Module>(),
    paths?: string[]
  ){
    const isFile = /^(.+?)(\.d\.ts)$/.test(root);

    this.cache = cache;

    if(isFile){
      this.file = root;
      this.paths = paths!;
    }
    else {
      const { main, name } = resolveMainTypes(root);
      const workspace = getWorkspace(root)

      this.file = main;
      this.name = name;
      this.paths = [root];

      if(workspace)
        this.paths.push(workspace)
    }
  }

  resolve(request: string){
    const loaded = this.cache;
    let target: Module | undefined;
  
    if(/^\./.test(request)){
      let dir = resolve(dirname(this.file), request)
  
      dir = dir.replace(/\/src$/g, "/lib");
  
      if(existsSync(dir) && lstatSync(dir).isDirectory()) 
        dir += "/index";
  
      dir += ".d.ts";
  
      if(!existsSync(dir))
        throw new Error();
  
      target = loaded.get(dir);
  
      if(!target){
        target = new Module(dir, loaded, this.paths);
        loaded.set(dir, target);
      }
    }
    else {
      const root = this.paths
        .map(r => resolve(r, "node_modules", request))
        .find(r => existsSync(r));
  
      if(!root)
        throw new Error(`${request} does not resolve to a directory`)
      
      target = loaded.get(root);
  
      if(!target){
        target = new Module(root, loaded);
        loaded.set(root, target);
      }
    }
  
    return target;
  }

  getter(...resolve: string[]): any {
    return () => {
      let current = this.output;
      for(const key of resolve){
        if(key == "*")
          return current
        current = (current as any)[key]
      }
      return current
    }
  }

  get output(){
    let value = this.parse();

    while(typeof value == "function")
      value = value()
    
    Object.defineProperty(this, "output", { value })
    return value;
  }

  parse(){
    const code = tryReadFile(this.file);

    if(!code)
      throw new Error("Could not find main types file");
  
    const queue = tryParseWithBabel(code);
    this.cache.set(this.root, this);
  
    const resolve = (request: string) => this.resolve(request)
    const parse = new Parser(resolve).run(queue);

    return parse.output;
  }
}