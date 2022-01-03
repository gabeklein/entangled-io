import { SourceFile, Node } from "ts-morph";

export function getSchemaFromSource(
  file: SourceFile,
  name: string){

  const endpoint = "http://localhost:8080";
  const output = getSchemaType(file);

  return {
    output,
    endpoint
  }
}

function getSchemaType(node: Node){
  if(Node.isSourceFile(node)){
    const output = {} as any;

    node
      .getExportedDeclarations()
      .forEach(([ value ], key) => {
        output[key] = getSchemaType(value);
      })

    return output;
  }

  if(Node.isFunctionDeclaration(node)){
    if(node.getAsyncKeyword())
      return true;
    else
      return false;
  }

  return null;
}