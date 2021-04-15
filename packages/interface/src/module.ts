import getWorkspace from 'find-yarn-workspace-root';
import { existsSync, lstatSync, realpathSync } from 'fs';
import { dirname, resolve } from 'path';

import { Parser } from './parse';
import { resolveMainTypes, tryParseWithBabel, tryReadFile } from './util';

export class Module {
  name?: string
  file: string;
  paths: string[];

  constructor(
    public root: string,
    public cache = new Map<string, Module>(),
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
      const workspace = paths && paths[1] || getWorkspace(root);

      this.file = main || "";
      this.name = name;
      this.paths = [root];

      if(workspace)
        this.paths.push(workspace)
    }
  }

  create(root: string, paths?: string[]){
    const { cache } = this;
    let mod = cache.get(root);
    
    if(!mod)
      cache.set(root, 
        mod = new Module(root, cache, paths)  
      );

    return mod;
  }

  resolve(request: string){  
    if(/^\./.test(request)){
      let dir = resolve(dirname(this.file), request)
  
      dir = dir.replace(/\/src$/g, "/lib");
  
      if(existsSync(dir) && lstatSync(dir).isDirectory()) 
        dir += "/index";
  
      dir += ".d.ts";
  
      if(!existsSync(dir))
        throw new Error(`File "${dir} wasn't found fam."`);
  
      return this.create(dir, this.paths);
    }
    else {
      let root;

      for(const path of this.paths){
        let full = resolve(path, "node_modules", request);

        if(existsSync(full) || existsSync(full += ".d.ts"))
          root = full;
      }

      if(!root)
        throw new Error(`Could not resolve ${request}!`);

      root = realpathSync(root);
      
      const workspace = this.paths[1];

      return this.create(root, workspace ? ["", workspace] : []);
    }
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
    if(!this.file)
      return {}

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