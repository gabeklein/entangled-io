import { Module } from './module';

type BunchOf<T> = { [key: string]: T };

export class Parser {
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
      if(typeof handler !== "function"){
        debugger
        throw new Error(`Unhandled type ${node.type}`)
      }
      else handler.call(this, node)
    }
    return this;
  }

  TSModuleDeclaration(node: any){
    const parent = node.into || this.scope;
    parent[node.id.name] = new Parser(this.resolve, this.scope).run(node.body.body).output;
  }

  ClassDeclaration(node: any){
    console.log("sdasd")
    void node;
    debugger
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
        (spec.type === "ImportDefaultSpecifier" ? "default" : "*");

      this.scope[localName] = external.getter(importedName);
    }
  }

  TSDeclareFunction(node: any){
    const parent = node.into || this.scope;
    parent[node.into_as || node.id.name] = true;
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

  ExportAllDeclaration(node: any){
    const external = this.resolve(node.source.value);

    for(const item in external.output){
      this.output[item] = external.output[item];
    }
  }

  ExportDefaultDeclaration(node: any){
    if(node.declaration){
      node.declaration.into = this.output;
      node.declaration.into_as = "default";
      this.queue.push(node.declaration)
      return
    }
    this.output.default = this.scope[node.expression.name];
  }

  ExportNamedDeclaration(node: any){
    if(node.declaration){
      node.declaration.into = this.output;
      this.queue.push(node.declaration)
      return
    }

    if(node.source){
      const external = this.resolve(node.source.value);
      for(const spec of node.specifiers)
        this.output[spec.exported.name] =
          external.getter(spec.local && spec.local.name || "*");
    }
    else {
      for(const spec of node.specifiers)
        this.output[spec.exported.name] = 
          this.scope[spec.local.name]
    }
  }

  TSTypeLiteral(typeAnnotation: any){
    const object = new ObjectLiteral();
  
    for(const entry of typeAnnotation.members){
      const key = entry.key.name;
      const target = entry.typeAnnotation.typeAnnotation;
      
      if(entry.type === "TSMethodSignature"){
        object[key] = true;
        continue;
      }
      let value = this.TSTypeAnnotation(target)
      if(typeof value == "function")
        setGet(object, key, () => unwrap(value))
      else {
        if(typeof value == "object")
          value = unwrapObject(value)

        object[key] = value;
      }
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
      const expr = typeAnnotation.exprName;

      if(expr.type == "TSQualifiedName")
        return this.TSQualifiedType(expr);
        
      const { name } = expr;
      return this.scope[name] || this.closure[name];
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
      value = this.TSQualifiedType(typeAnnotation.typeName)

    else if(type == "TSImportType"){
      const resolve = flattenQualified(typeAnnotation.qualifier);
      value = this.resolve(typeAnnotation.argument.value).getter(...resolve);
    }
  
    if(params)
      if(typeof value == "function")
        return () => {
          return new ParameterizedType(unwrap(value), params)
        }
      else
        return new ParameterizedType(value, params)
    else
      return value;
  }

  TSQualifiedType(typeAnnotation: any){
    const [ head, ...rest ] = flattenQualified(typeAnnotation)
    const item: any = this.scope[head] || this.closure[head];
    if(typeof item == "function")
      return () => drill(unwrap(item), rest)
    else
      return drill(item, rest)
  }
}

function unwrap(x: any){
  while(typeof x === "function")
    x = x()

  if(typeof x == "object")
    x = unwrapObject(x);

  return x;
}

function unwrapObject(node: { [key: string]: any }){
  if(node instanceof InterfaceType)
    return undefined

  const output = {} as any;

  for(const key in node){
    const value = node[key];

    if(typeof value == "function")
      setGet(output, key, () => unwrap(value));
    else if(typeof value == "object")
      output[key] = unwrapObject(value);
    else
      output[key] = value;
  }

  if(Object.keys(output).length === 0)
    return undefined;
  
  return output;
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