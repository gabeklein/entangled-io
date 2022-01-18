import { Node, SourceFile } from "ts-morph";

export function createManifest(
  node: Node, watch: Set<string>){

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

  if(Node.isFunctionDeclaration(node)){
    if(node.getAsyncKeyword())
      return true;
    else
      return false;
  }

  return null;
}