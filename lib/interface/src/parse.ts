import getWorkspace from 'find-yarn-workspace-root';
import { existsSync, lstatSync } from 'fs';
import { dirname, resolve } from 'path';

import { resolveMainTypes, tryParseWithBabel, tryReadFile } from './util';

export function collateTypes(root: string){
  return new Module(root);
}

class Module {
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
    let current = this.output;
    for(const key of resolve){
      if(key == "*")
        return current
      current = (current as any)[key]
    }
    return current
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

class Parser {
  queue = [] as any[];
  output = {} as BunchOf<any>;
  scope = Object.create(this.output);

  constructor(
    public resolve: (abs: string) => Module,
    private closure: BunchOf<any> = {}
  ){}

  run(queue: any[]){
    this.queue = queue;
    for(const node of queue){
      const handler = (this as any)[node.type];
      if(typeof handler !== "function")
        throw new Error(`Unhandled type ${node.type}`)
      else handler.call(this, node)
    }
    return this;
  }

  TSModuleDeclaration(node: any){
    const parent = node.into || this.scope;
    parent[node.id.name] = new Parser(this.resolve, this.scope).run(node.body.body).output;
  }

  TSInterfaceDeclaration(node: any){
    const parent = node.into || this.scope;
    const type = new InterfaceType();

    if(node.leadingComments)
      type.comment = node.leadingComments[0].value;
      
    parent[node.id.name] = type;
  }

  TSTypeAliasDeclaration(node: any){
    const { name } = node.id;
    const parent = node.into || this.scope;
    const alias = parent[name] = new TypeAlias();
    alias.comment = `TypeAlias:${name}`
  }
  
  ImportDeclaration(node: any){
    const external = this.resolve(node.source.value);
    
    for(const spec of node.specifiers){
      const localName = spec.local?.name;
      const importedName = spec.imported?.name ||
        spec.type === "ImportDefaultSpecifier" ? "default" : "*";

      this.scope[localName] = external.getter(importedName);
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
    this.output = this.scope[node.expression.name];
  }

  ExportDefaultDeclaration(node: any){
    this.output.default = this.scope[node.expression.name];
  }

  ExportNamedDeclaration(node: any){
    if(node.declaration){
      node.declaration.into = this.output;
      this.queue.push(node.declaration)
    }
    else for(const spec of node.specifiers)
      this.output[spec.exported.name] = 
        this.scope[spec.local.name]
  }

  TSTypeLiteral(typeAnnotation: any){
    const object = new ObjectLiteral();
  
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

  TSLiteralType(typeAnnotation: any){
    return 
  }

  TSTypeAnnotation(typeAnnotation: any){
    while(typeAnnotation.type == "TSTypeAnnotation")
      ({ typeAnnotation } = typeAnnotation)
  
    const { type } = typeAnnotation;

    if(type == "TSTypeQuery"){
      const { name } = typeAnnotation.exprName;
      return this.scope[name] | this.closure[name];
    }
  
    if(type == "TSLiteralType")
      return typeAnnotation.literal.value
  
    if(type == "TSFunctionType")
      return "function"
  
    if(type == "TSTypeLiteral")
      return this.TSTypeLiteral(typeAnnotation);
  
    const tp = typeAnnotation.typeParameters?.params;
    const params: any[] = tp?.map((a: any) => this.TSTypeAnnotation(a))
  
    if(params)
      params.forEach((x, i) => {
        if(typeof x == "function")
          setGet(params, i, x)
      })
  
    let value: any;
      
    if(type == "TSTypeReference")
      value = this.TSTypeReference(typeAnnotation)

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

  TSTypeReference(typeAnnotation: any){
    const [ head, ...rest ] = flattenQualified(typeAnnotation.typeName)
    const item: any = this.scope[head] | this.closure[head];
    if(typeof item == "function")
      return () => drill(item(), rest)
    else
      return drill(item, rest)
  }
}

function drill(from: any, resolve: string[] = []){
  return resolve.reduce((o, k) => o[k], from);
}

function setGet(obj: any, key: string | number, getter: () => any){
  return Object.defineProperty(obj, key, { get: getter, enumerable: true });
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

class ParameterizedType {
  constructor(
    public modifier: any,
    public params: any[]
  ){}
}

class TypeAlias {
  comment?: string;
}

class InterfaceType {
  comment?: string;
}

class ObjectLiteral {
  [ key: string ]: any
}