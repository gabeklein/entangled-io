import { Node, Project, ts } from 'ts-morph';

declare namespace Parser {
  type ExportItem =
    | {
      name: string;
      type: "function";
      async: boolean;
    }
    | {
      name: string;
      type: "module";
      path: string;
    }
    | {
      name: string;
      type: "error";
    }
}

export class Parser extends Project {
  constructor(){
    super({
      skipAddingFilesFromTsConfig: true,
      tsConfigFilePath: ts.findConfigFile(
        process.cwd(), ts.sys.fileExists
      )
    });
  }

  include(path: string, reload?: boolean){
    if(reload){
      const existingSourceFile = this.getSourceFile(path);

      if(existingSourceFile)
        this.removeSourceFile(existingSourceFile);
    }

    const sourceFile = this.addSourceFileAtPath(path);

    this.resolveSourceFileDependencies();

    const exports = sourceFile.getExportedDeclarations();
    const manifest = new Set<Parser.ExportItem>();

    for(const [ key, [ value ] ] of exports){
      if(Node.isSourceFile(value)){
        manifest.add({
          name: key,
          type: "module",
          path: value.getFilePath()
        });
        continue;
      }

      if(Node.isFunctionDeclaration(value)){
        manifest.add({
          name: key,
          type: "function",
          async: !!value.getAsyncKeyword()
        });
        continue;
      }

      if(isErrorType(value)){
        manifest.add({
          name: key,
          type: "error"
        });
      }
    }

    return manifest;
  }
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