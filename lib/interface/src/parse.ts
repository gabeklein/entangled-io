import getWorkspace from 'find-yarn-workspace-root';
import { existsSync } from 'fs';
import { dirname, resolve } from 'path';

import { resolveMainTypes, tryParseWithBabel, tryReadFile } from './util';

const loadedModules = new Map<string, Module>();

export async function collateTypes(root: string){
  const mod = new Module(root);

  mod.parse()

  debugger
  void 0
}

function registerModule(mod: Module){
  loadedModules.set(mod.root, mod);

  return (request: string) => resolveModule(mod, request)
}

function resolveModule(from: Module, request: string){
  const loaded = loadedModules;
  let target: Module | undefined;

  if(/^\./.test(request)){
    const file = resolve(dirname(from.file), request) + ".d.ts";
    target = loaded.get(file);

    if(!target){
      target = new Module(file, from.paths);
      loaded.set(file, target);
    }
  }
  else {
    const root = from.paths
      .map(r => resolve(r, "node_modules", request))
      .find(r => existsSync(r));

    if(!root)
      throw new Error(`${request} does not resolve to a directory`)
    
    target = loaded.get(root);

    if(!target){
      target = new Module(root);
      loaded.set(root, target);
    }
  }

  return target;
}

class Module {
  name?: string
  file: string;
  paths: string[];

  constructor(
    public root: string,
    paths?: string[]
  ){
    const isFile = /^(.+?)(\.d\.ts)$/.test(root);

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

  getter(...resolve: string[]): any {
    let current = this.output;
    for(const key of resolve){
      if(key == "*")
        return current
      current = (current as any)[key]
    }
    return current
  }

  get output(){
    const value = this.parse();
    Object.defineProperty(this, "output", { value })
    return value;
  }

  parse(){
    const code = tryReadFile(this.file);

    if(!code)
      throw new Error("Could not find main types file");
  
    const queue = tryParseWithBabel(code);
    const resolve = registerModule(this);
    const parse = new Parser(resolve).run(queue);

    cloneValueOrGetter(parse, "output", this)
  }
}

class Parser {
  queue = [] as any[];
  output = {} as BunchOf<any>;
  private scope = Object.create(this.output);

  constructor(
    public resolve: (abs: string) => Module
  ){}

  run(queue: any[]){
    this.queue = queue;
    for(const node of queue)
      (this as any)[node.type](node);
  }
  
  ImportDeclaration(node: any){
    const external = this.resolve(node.source.value);
    
    for(const spec of node.specifiers){
      const local = spec.local?.name;
      const importedName = spec.imported?.name ||
        spec.type === "ImportDefaultSpecifier" ? "default" : "*";

      setGet(this.scope, local, external.getter(importedName))
    }
  }

  TSDeclareFunction(node: any){
    const parent = node.into || this.scope;
    parent[node.id.name] = "function";
  }

  VariableDeclaration(node: any){
    const { scope } = this;

    let { name, typeAnnotation } = node.declarations[0].id;
    const item = this.TSTypeAnnotation(typeAnnotation);
    const parent = node.into || scope;
    parent[name] = item;
  }

  TSExportAssignment(node: any){
    cloneValueOrGetter(
      this.scope,
      node.expression.name
      (this as any),
      "output"
    )
  }

  ExportDefaultDeclaration(node: any){
    cloneValueOrGetter(
      this.scope,
      node.declaration.name,
      this.output,
      "default"
    )
  }

  ExportNamedDeclaration(node: any){
    if(node.declaration){
      node.declaration.into = this.output;
      this.queue.push(node.declaration)
    }
    else for(const spec of node.specifiers)
      cloneValueOrGetter(
        this.scope,
        spec.local.name,
        this.output,
        spec.exported.name
      )
  }

  TSTypeLiteral(typeAnnotation: any){
    const object: BunchOf<any> = {};
  
    for(const entry of typeAnnotation.members){
      const key = entry.key.name;
      const target = entry.typeAnnotation.typeAnnotation;
      
      const value = this.TSTypeAnnotation(target)
      if(typeof value == "function")
        setGet(object, key, value as any)
      else
        object[key] = value;
    }
  
    return object
  }

  TSTypeAnnotation(typeAnnotation: any){
    const { scope } = this;

    while(typeAnnotation.type == "TSTypeAnnotation")
      ({ typeAnnotation } = typeAnnotation)
  
    const { type } = typeAnnotation;
  
    if(type == "TSLiteralType")
      return "literal"
  
    if(type == "TSFunctionType")
      return "function"
  
    if(type == "TSTypeLiteral")
      return this.TSTypeLiteral(typeAnnotation);
  
    const tp = typeAnnotation.typeParameters?.params;
    const params: any[] = tp?.map((a: any) => this.TSTypeAnnotation(a))
  
    params.forEach((x, i) => {
      if(typeof x == "function")
        setGet(params, i, x)
    })
  
    let value: any;
      
    if(type == "TSTypeReference"){
      const resolve = flattenQualified(typeAnnotation.typeName)
      value = () => resolve.reduce((x: any, k: string) => x[k], scope)
    }
    else if(type == "TSImportType"){
      const resolve = flattenQualified(typeAnnotation.qualifier);
      value = () => this.resolve(typeAnnotation.argument.value).getter(...resolve);
    }
  
    if(params)
      if(typeof value == "function")
        return () => new ParameterizedType(value(), params)
      else
        return new ParameterizedType(value, params)
    else
      return value;
  }
}

function setGet(obj: any, key: string | number, getter: () => any){
  return Object.defineProperty(obj, key, { get: getter, enumerable: true });
}

function cloneValueOrGetter(
  from: any, key: string, to: any, toKey?: string){

  const getter = findGet(from, key);
  if(getter)
    setGet(to, toKey || key, getter)
  else
    to[toKey || key]
}

function flattenQualified(left: any){
  const list = [];
  while(left.right){
    list.unshift(left.right.name);
    left = left.left;
  }
  list.unshift(left.name);
  return list as string[];
}

function findGet(obj: any, key: string){
  do {
    const getter = Object.getOwnPropertyDescriptor(obj, key)?.get;
    if(getter)
      return getter
  }
  while(obj = Object.getPrototypeOf(obj));
  return undefined;
}

class ParameterizedType {
  constructor(
    public modifier: any,
    public params: any[]
  ){}
}