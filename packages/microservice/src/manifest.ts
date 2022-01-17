import { Node } from "ts-morph";

export function createManifest(
  node: Node, watch: Set<string>){

  if(Node.isSourceFile(node)){
    const output = {} as any;

    watch.add(node.getFilePath());

    node
      .getExportedDeclarations()
      .forEach(([ value ], key) => {
        output[key] = createManifest(value, watch);
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