/**
 * This logic is heavily adapted from dts-bundle by TypeStrong
 * https://github.com/TypeStrong/dts-bundle
 */

import detectIndent from 'detect-indent';
import fs from 'fs';
import glob from 'glob';
import os from 'os';
import { basename, dirname, join, relative, resolve, sep } from 'path';

'use strict';

const bomOptExp = /^\uFEFF?/;
const externalExp = /^([ \t]*declare module )(['"])(.+?)(\2[ \t]*{?.*)$/;
const importExp = /^([ \t]*(?:export )?(?:import .+? )= require\()(['"])(.+?)(\2\);.*)$/;
const importEs6Exp = /^([ \t]*(?:export|import) ?(?:(?:\* (?:as [^ ,]+)?)|.*)?,? ?(?:[^ ,]+ ?,?)(?:\{(?:[^ ,]+ ?,?)*\})? ?from )(['"])([^ ,]+)(\2;.*)$/;
const referenceTagExp = /^[ \t]*\/\/\/[ \t]*<reference[ \t]+path=(["'])(.*?)\1?[ \t]*\/>.*$/;
const identifierExp = /^\w+(?:[\.-]\w+)*$/;
const fileExp = /^([\./].*|.:.*)$/;
const privateExp = /^[ \t]*(?:static )?private (?:static )?/;
const publicExp = /^([ \t]*)(static |)(public |)(static |)(.*)/;
const jsDoc = /^[ \t]*\/\*\*/;

const newline = os.EOL;
const indent = '    ';
const separator = '/'

export interface ModLine {
  original: string;
  modified?: string;
  skip?: boolean;
}

export interface Result {
  file: string;
  name: string;
  indent: string;
  exp: string;
  refs: string[];
  externalImports: string[];
  relativeImports: string[];
  exports: string[];
  lines: ModLine[];
  importLineRef: ModLine[];
  relativeRef: ModLine[];
  fileExists: boolean;
}

export function bundle(main: string, exportName: string) {
  const baseDir = dirname(main)
  let mainFile = resolve(main.replace(/\//g, sep));

  const getModName = (file: string) => relative(baseDir, dirname(file) + sep + basename(file).replace(/\.d\.ts$/, ''));
  const expName = (file: string) => file === mainFile ? exportName : expNameRaw(file);
  const expNameRaw = (file: string) => exportName + separator + cleanupName(getModName(file));
  const libName = (ref: string) => expNameRaw(mainFile) + separator + separator + ref;
  const cleanupName = (name: string) => name.replace(/\.\./g, '--').replace(/[\\\/]/g, "/");

  // turn relative paths into absolute paths
  const sourceTypings = glob.sync('**/*.d.ts', { cwd: baseDir }).map(file => resolve(baseDir, file));

  const inSourceTypings = (file: string) =>
    sourceTypings.indexOf(file) !== -1 || sourceTypings.indexOf(join(file, 'index.d.ts')) !== -1;
  // if file reference is a directory assume commonjs index.d.ts

  let fileMap: { [name: string]: Result; } = Object.create(null);
  let globalExternalImports: string[] = [];
  let mainParse: Result | undefined; // will be parsed result of first parsed file
  let externalTypings: string[] = [];

  {
    let queue: string[] = [mainFile];
    let queueSeen: { [name: string]: boolean; } = Object.create(null);

    while (queue.length > 0) {
      let target = queue.shift()!;
      if (queueSeen[target])
        continue;

      queueSeen[target] = true;

      // parse the file
      let parse = parseFile(
        target,
        getModName(target),
        expName,
        sourceTypings,
        externalTypings
      );

      if (!mainParse)
        mainParse = parse;

      fileMap[parse.file] = parse;
      pushUniqueArr(queue, parse.refs, parse.relativeImports);
    }
  }

  let exportMap = Object.create(null);

  for(const file of Object.keys(fileMap)){
    let parse = fileMap[file];
    for(const name of parse.exports)
      exportMap[name] = parse;
  }

  let usedTypings: Result[] = [];
  let externalDependencies: string[] = []; // lists all source files that we omit due to !externals

  {
    let queue = [mainParse];
    let queueSeen: { [name: string]: boolean; } = Object.create(null);

    while (queue.length > 0) {
      let parse = queue.shift()!;
      if (queueSeen[parse.file])
        continue;
      queueSeen[parse.file] = true;

      usedTypings.push(parse);

      for(const name of parse.externalImports){
        let p = exportMap[name];
        pushUnique(externalDependencies, !p ? name : p.file);
      }

      for(const file of parse.relativeImports){
        let p = fileMap[file];
        queue.push(p);
      }
    }
  }

  for (const parse of usedTypings) {
    for (const line of parse.relativeRef)
      line.modified = replaceExternal(line.original, libName);

    for (const line of parse.importLineRef)
      if (importExp.test(line.original))
        line.modified = replaceImportExport(line.original, libName);
      else
        line.modified = replaceImportExportEs6(line.original, libName);
  }

  let content = "";

  if (externalDependencies.length > 0) {
    content += '// Dependencies for this module:' + newline;
    for (const file of externalDependencies)
      content += '//   ' + relative(baseDir, file).replace(/\\/g, '/') + newline;
  }

  if (globalExternalImports.length > 0) {
    content += newline;
    content += globalExternalImports.join(newline) + newline;
  }

  content += newline;

  for (const used of usedTypings)
    used.lines = used.lines.filter(
      (line: ModLine) => !line.skip
    )

  // add wrapped modules to output
  content += usedTypings
    .filter(parse => parse.lines.length > 0)
    .map(parse => {
      const { file } = parse;
      const lines = parse.lines.map(line => getIndenter(parse.indent, indent)(line));

      return inSourceTypings(file)
        ? formatModule(file, lines, expName(file))
        : lines.join(newline).concat(newline)
    })
    .join(newline)
    .concat(newline);

  return content;
}

function formatModule(file: string, lines: string[], exp: string) {
  let out = '';

  out += 'declare module \'' + exp + '\' {' + newline;
  out += (lines.length === 0 ? '' : indent + lines.join(newline + indent)) + newline
  out += '}' + newline;
  return out;
}

// main info extractor
function parseFile(
  file: string,
  name: string,
  expName: (x: string) => string,
  sourceTypings: string[],
  externalTypings: string[]): Result {

  const inExternalTypings = (file: string) => externalTypings.indexOf(file) !== -1;
  const inSourceTypings = (file: string) => 
    sourceTypings.indexOf(file) !== -1 || 
    sourceTypings.indexOf(join(file, 'index.d.ts')) !== -1;

  const res: Result = {
    file,
    name,
    indent,
    exp: expName(file),
    refs: [], // triple-slash references
    externalImports: [], // import()'s like "events"
    relativeImports: [], // import()'s like "./foo"
    exports: [],
    lines: [],
    fileExists: true,
    // the next two properties contain single-element arrays, which reference the same single-element in .lines,
    // in order to be able to replace their contents later in the bundling process.
    importLineRef: [],
    relativeRef: []
  };

  if (!fs.existsSync(file)) {
    res.fileExists = false;
    return res;
  }
  if (fs.lstatSync(file).isDirectory())
    file = join(file, 'index.d.ts');

  const code = fs.readFileSync(file, 'utf8').replace(bomOptExp, '').replace(/\s*$/, '');
  res.indent = detectIndent(code) || indent;

  // buffer multi-line comments, handle JSDoc
  let multiComment: string[] = [];
  let queuedJSDoc: string[] | undefined;
  let inBlockComment = false;

  function popBlock() {
    inBlockComment = false;

    if (multiComment.length < 1)
      return

    if (jsDoc.test(multiComment[0]))
      queuedJSDoc = multiComment;

    multiComment = [];
  };

  function popJSDoc() {
    if (!queuedJSDoc)
      return

    for (const line of queuedJSDoc) {
      // fix shabby TS JSDoc output
      let match = line.match(/^([ \t]*)(\*.*)/);
      if (match)
        res.lines.push({ original: match[1] + ' ' + match[2] });
      else
        res.lines.push({ original: line });
    }

    queuedJSDoc = undefined;
  };

  for (let line of code.split(/\r?\n/g)) {
    // block comment end
    if (/^[((=====)(=*)) \t]*\*+\//.test(line)) {
      multiComment.push(line);
      popBlock();
      continue;
    }

    // block comment start
    if (/^[ \t]*\/\*/.test(line)) {
      multiComment.push(line);
      inBlockComment = true;

      // single line block comment
      if (/\*+\/[ \t]*$/.test(line))
        popBlock();

      continue;
    }

    if (inBlockComment) {
      multiComment.push(line);
      continue;
    }

    // blankline
    if (/^\s*$/.test(line)) {
      res.lines.push({ original: '' });
      continue;
    }

    // reference tag
    if (/^\/\/\//.test(line)) {
      let ref = extractReference(line);
      if (ref) {
        let refPath = resolve(dirname(file), ref);
        if (!inSourceTypings(refPath) && !inExternalTypings(refPath)) {
          externalTypings.push(refPath);
        }
        pushUnique(res.refs, refPath);
        continue;
      }
    }

    // line comments
    if (/^\/\//.test(line))
      continue;

    // private member
    if (privateExp.test(line)) {
      queuedJSDoc = undefined;
      continue;
    }

    popJSDoc();

    let match = 
      line.indexOf("from") >= 0 ? line.match(importEs6Exp) :
      line.indexOf("require") >= 0 ? line.match(importExp) :
      null;

    // import() statement or es6 import
    if (match) {
      const [, lead, quote, moduleName, trail] = match!;

      const impPath = resolve(dirname(file), moduleName);

      // filename (i.e. starts with a dot, slash or windows drive letter)
      if (fileExp.test(moduleName)) {
        // TODO: some module replacing is handled here, whereas the rest is
        // done in the "rewrite global external modules" step. It may be
        // more clear to do all of it in that step.
        let modLine: ModLine = {
          original: lead + quote + expName(impPath) + trail
        };
        res.lines.push(modLine);

        let full = resolve(dirname(file), impPath);
        // If full is not an existing file, then let's assume the extension .d.ts
        if (!fs.existsSync(full) || fs.existsSync(full + '.d.ts')) {
          full += '.d.ts';
        }
        pushUnique(res.relativeImports, full);
        res.importLineRef.push(modLine);
      }
      // identifier
      else {
        let modLine: ModLine = { original: line };

        pushUnique(res.externalImports, moduleName);
        res.lines.push(modLine);
      }
    }

    // declaring an external module
    // this triggers when we're e.g. parsing external module declarations, such as node.d.ts
    else if (match = line.match(externalExp)) {
      const moduleName = match[3]

      pushUnique(res.exports, moduleName);
      let modLine: ModLine = { original: line };
      res.relativeRef.push(modLine); // TODO
      res.lines.push(modLine);
    }

    // clean regular lines
    else {
      // remove public keyword
      if ((match = line.match(publicExp))) {
        let [, sp, static1, , static2, ident] = match;
        line = sp + static1 + static2 + ident;
      }

      // for internal typings, remove the 'declare' keyword (but leave 'export' intact)
      if (inSourceTypings(file))
        line = line.replace(/^(export )?declare /g, '$1');

      res.lines.push({ original: line });
    }
  }

  return res;
}

function pushUnique<T>(arr: T[], value: T) {
  if (arr.indexOf(value) < 0)
    arr.push(value);
  return arr;
}

function pushUniqueArr<T>(arr: T[], ...values: T[][]) {
  for (const vs of values)
    for (const v of vs)
      pushUnique(arr, v)
  return arr;
}

function extractReference(tag: string) {
  let match = tag.match(referenceTagExp);
  return match ? match[2] : null;
}

function replaceImportExport(line: string, replacer: (str: string) => string) {
  let match = line.match(importExp);
  if (match)
    if (identifierExp.test(match[3]))
      return match[1] + match[2] + replacer(match[3]) + match[4];
  return line;
}

function replaceImportExportEs6(line: string, replacer: (str: string) => string) {
  if (line.indexOf("from") < 0)
    return line;
  let match = line.match(importEs6Exp);
  if (match && identifierExp.test(match[3]))
    return match[1] + match[2] + replacer(match[3]) + match[4];
  return line;
}

function replaceExternal(line: string, replacer: (str: string) => string) {
  let match = line.match(externalExp);
  if (match) {
    let [, declareModule, beforeIndent, moduleName, afterIdent] = match;
    if (identifierExp.test(moduleName))
      return declareModule + beforeIndent + replacer(moduleName) + afterIdent;
  }
  return line;
}

function getIndenter(actual: string, use: string): (line: ModLine) => string {
  if (actual === use || !actual)
    return line => line.modified || line.original;
  return line => (line.modified || line.original).replace(new RegExp('^' + actual + '+', 'g'), match => match.split(actual).join(use));
}