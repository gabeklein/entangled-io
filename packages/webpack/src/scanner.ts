import { ExportAssignment, Project, SourceFile, Type } from 'ts-morph';

import { Recursive } from './types';

export function resolveTargetModules(
  project: Project,
  modules: string[]){

  const targets = new Map<string, SourceFile>();
  const mockFiles = modules.map((name, index) => {
    const filename = `./${index}.ts`;
    const contents = `import * from "${name}"`;

    return project.createSourceFile(filename, contents);
  })

  project.resolveSourceFileDependencies();

  mockFiles.forEach(source => {
    const [ target ] = source.getImportDeclarations();
    
    targets.set(
      target.getModuleSpecifierValue()!,
      target.getModuleSpecifierSourceFileOrThrow()
    )
  })

  return targets;
}

export function getSchemaFromSource(
  file: SourceFile,
  name: string){

  const exportType =
    file.getExportAssignment(isExpressiveEntangledType);

  if(!exportType)
    throw new Error(`Imported "${name}" does not export an Entangled interface. This is required.`)

  return parseExportAssignment(exportType);
}

function parseExportAssignment(x: ExportAssignment){
  const exportType = x.getExpression().getType();

  const [
    endpointArgument,
    interfaceArgument
  ] = exportType.getAliasTypeArguments();

  if(!endpointArgument.isStringLiteral())
    throw new Error("Endpoint is not properly defined here!")
  
  const endpoint = String(endpointArgument.getLiteralValue());
  const output = parseResourceType(interfaceArgument);

  if(typeof output == "boolean")
    throw new Error("Exports are malformed")

  return { endpoint, output };
}

function parseObjectType(type: Type){
  const properties = type.getProperties();
  const acc: Recursive<boolean> = {};

  for(const prop of properties){
    const keyName = prop.getName();
    const decl = prop.getDeclarations()[0];
    const typeOfValue = decl.getType();

    acc[keyName] = parseResourceType(typeOfValue);
  }
  
  return acc;
}

function parseResourceType(type: Type){
  if(isFunctionType(type))
    return true;

  if(type.isObject())
    return parseObjectType(type);

  return false;
}

function isExpressiveEntangledType(
  assignment: ExportAssignment){

  const exportType = assignment
    .getExpression()
    .getType();

  const qualified = exportType
    .getAliasSymbolOrThrow()
    .getFullyQualifiedName();

  return /\.Entangled\.Resources$/.test(qualified);
}

function isFunctionType(type: Type){
  return type.getCallSignatures().length > 0
}