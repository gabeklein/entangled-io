import { parse as babelParse } from '@babel/parser';
import generate from '@babel/generator';
import traverse, { TraverseOptions } from '@babel/traverse';
import * as t from '@babel/types';

export default t;

export function _id(name: string): t.Identifier {
  return t.identifier(name);
}

export function parse(text: string){
  return babelParse(text, { sourceType: 'module' }).program.body
}

export function transform(source: string, opts: TraverseOptions){
  const ast = babelParse(source, {
    sourceType: 'module',
    plugins: ['typescript']
  });

  traverse(ast, opts);

  return generate(ast, { retainLines: true }).code;
}

export function _template(...parts: (string | t.Expression)[]): t.TemplateLiteral {
  const quasis: t.TemplateElement[] = [];
  const expressions: t.Expression[] = [];

  parts.forEach((part, i) => {
    if(i % 2 === 0) {
      quasis.push(t.templateElement({
        raw: part as string,
        cooked: part as string
      }, i === parts.length - 1));
      return;
    }

    if (typeof part === 'string')
      part = t.identifier(part);

    expressions.push(part);
  });

  return t.templateLiteral(quasis, expressions);
}

export function _objectExpression(props: Record<string, t.Expression>): t.ObjectExpression {
  return t.objectExpression(
    Object.entries(props).map(([key, value]) =>
      t.objectProperty(t.identifier(key), value)
    )
  );
}

export function _arrowFunction(
  params: string[],
  body: t.Statement[] | t.Expression
): t.ArrowFunctionExpression {
  return t.arrowFunctionExpression(
    params.map(_id),
    Array.isArray(body) ? t.blockStatement(body) : body
  );
}

export function _memberExpression(path: string): t.Expression {
  // Don't split on dots that are inside template strings
  const parts = Array.from(path.match(/[^.\s]+/g) || []);
  return parts.slice(1).reduce<t.Expression>(
    (acc, part) => t.memberExpression(acc, t.identifier(part)), 
    t.identifier(parts[0])
  );
}

// When we use _call with a string path, it should directly access the property
export function _call(
  callee: string | t.Expression,
  args: (string | t.Expression)[]
): t.CallExpression {
  return t.callExpression(
    typeof callee === 'string' ? 
      _memberExpression(callee) :
      callee,
    args.map(arg => typeof arg === 'string' ? _id(arg) : arg)
  );
}

export function _new(
  className: string,
  args: (string | t.Expression)[]
): t.NewExpression {
  return t.newExpression(
    t.identifier(className),
    args.map(arg => typeof arg === 'string' ? _id(arg) : arg)
  );
}

export function _var(
  kind: 'const' | 'let' | 'var',
  name: string,
  init: t.Expression
): t.VariableDeclaration {
  return t.variableDeclaration(kind, [
    t.variableDeclarator(t.identifier(name), init)
  ]);
}

export function _return(argument: string | t.Expression): t.ReturnStatement {
  return t.returnStatement(
    typeof argument === 'string' ? _id(argument) : argument
  );
}

export function _export(
  local: string,
  exported: string
): t.ExportNamedDeclaration {
  return t.exportNamedDeclaration(
    null,
    [t.exportSpecifier(t.identifier(local), t.identifier(exported))]
  );
}
