import getWorkspace from 'find-yarn-workspace-root';
import { existsSync, lstatSync, realpathSync } from 'fs';
import { dirname, resolve } from 'path';

import { Parser } from './parse';
import { resolveMainTypes, tryParseWithBabel, tryReadFile } from './util';

export class Module {
  name?: string
  file: string;

  constructor(
    public root: string,
    public cache = new Map<string, Module>(),
    public workspace?: string
  ){
    const isFile = /^(.+?)(\.d\.ts)$/.test(root);

    this.cache = cache;

    if(isFile){
      this.file = root;
    }
    else {
      const { main, name } = resolveMainTypes(root);

      if(!workspace)
        this.workspace = getWorkspace(root) || undefined;

      this.file = main || "";
      this.name = name;
    }
  }

  create(root: string){
    const { cache } = this;
    let mod = cache.get(root);
    
    if(!mod)
      cache.set(root, 
        mod = new Module(root, cache, this.workspace)  
      );

    return mod;
  }

  resolver = (r: string) => {
    return /^\./.test(r)
      ? this.resolveFile(r)
      : this.resolveRoot(r)
  }

  resolveFile(uri: string){
    let dir = resolve(dirname(this.file), uri)

    dir = dir.replace(/\/src$/g, "/lib");

    if(existsSync(dir) && lstatSync(dir).isDirectory()) 
      dir += "/index";

    dir += ".d.ts";

    if(!existsSync(dir))
      throw new Error(`File "${dir} wasn't found fam."`);

    return this.create(dir);
  }

  resolveRoot(request: string){
    let root;

    for(const path of [this.root, this.workspace])
      if(path){
        let full = resolve(path, "node_modules", request);

        if(existsSync(full) || existsSync(full += ".d.ts")){
          root = full;
          break;
        }
      }

    if(!root)
      throw new Error(`Could not resolve ${request}!`);

    root = realpathSync(root);

    return this.create(root);
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

    const parse = new Parser(this.resolver);

    return parse.run(queue).output;
  }
}