import { FunctionDeclaration, Node, SourceFile } from 'ts-morph';

export function parse(
  node: Node, watch: Set<string>){

  if(Node.isSourceFile(node))
    return handleSourceFile(node, watch);

  if(Node.isFunctionDeclaration(node))
    return handleFunction(node);

  if(isErrorType(node))
    return [2];

  return isErrorType(node) || null
}

function handleSourceFile(
  node: SourceFile, watch: Set<string>){

  const output = {} as any;

  node
    .getExportedDeclarations()
    .forEach(([ value ], key) => {
      const source: SourceFile = (value as any).__sourceFile;

      // some exports may be `export * from "x"`
      // and come from a different file;
      // register file dependancies per import  `
      watch.add(source.getFilePath());

      output[key] = parse(value, watch);
    })

  return output;
}

function isErrorType(node: Node){
  try {
    while(Node.isClassDeclaration(node)){
      const exp = node.getExtendsOrThrow().getExpression();
      
      if(Node.isIdentifier(exp))
        node = exp.getSymbolOrThrow().getValueDeclarationOrThrow();
      else
        break;
    }

    if(Node.isVariableDeclaration(node) && 
      node.getText() == "Error:ErrorConstructor")
        return true
  }
  catch(err){}

  return false;
}

function handleFunction(node: FunctionDeclaration){
  const signatures = [ node, ...node.getOverloads() ];

  if(!node.getAsyncKeyword())
    return [0];

  const overloads = signatures.map(getParams).filter(x => x.length);

  return [1, overloads];  
}

function getParams(node: FunctionDeclaration){
  const parameters = [] as string[];

  // const [ jsDoc ] = node.getJsDocs();
  // const docs = jsDoc.getStructure();

  for(const param of node.getParameters()){
    // const type = param.getType();
    
    let {
      name,
      isRestParameter,
      hasQuestionToken
    } = param.getStructure();

    if(isRestParameter)
      name = "..." + name;

    if(hasQuestionToken)
      name += "?";

    parameters.push(name);
  }

  return parameters;
}