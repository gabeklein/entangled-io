import { FunctionDeclaration, Node, SourceFile } from "ts-morph";

export function createManifest(
  node: Node, watch: Set<string>){

  return (
    handleSourceFile(node, watch) ||
    handleFunction(node) ||
    handleErrorType(node) || 
    null
  )
}

function handleSourceFile(node: Node, watch: Set<string>){
  if(Node.isSourceFile(node)){
    const output = {} as any;

    node
      .getExportedDeclarations()
      .forEach(([ value ], key) => {
        const source: SourceFile = (value as any).__sourceFile;

        // some exports may be `export * from "x"`
        // and come from a different file;
        // register file dependancies per import
        watch.add(source.getFilePath());

        output[key] = createManifest(value, watch);
      })

    return output;
  }
}

function handleErrorType(node: Node){
  try {
    while(Node.isClassDeclaration(node)){
      const exp = node.getExtendsOrThrow().getExpression();
      
      if(Node.isIdentifier(exp))
        node = exp.getSymbolOrThrow().getValueDeclarationOrThrow();
      else
        return;
    }

    if(Node.isVariableDeclaration(node) && 
      node.getText() == "Error:ErrorConstructor")
        return [2];
  }
  catch(err){
    return;
  }
  return;
}

function handleFunction(node: Node){
  if(Node.isFunctionDeclaration(node)){
    const signatures =
      [ node, ...node.getOverloads() ].map(params);

    if(node.getAsyncKeyword())
      return [1, ...signatures.filter(x => x.length)];
    else
      return [0];
  }
  
  return undefined;
}

function params(node: FunctionDeclaration){
  const args = [] as string[];

  for(const param of node.getParameters()){
    let {
      name,
      isRestParameter,
      hasQuestionToken
    } = param.getStructure();

    if(isRestParameter)
      name = "..." + name;

    if(hasQuestionToken)
      name += "?";

    args.push(name);
  }

  return args;
}