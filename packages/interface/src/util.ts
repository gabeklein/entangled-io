import { existsSync, statSync, readFileSync } from "fs";
import * as path from "path";

const babel = require("@babel/core");
const babel_ts = require("@babel/plugin-syntax-typescript");

export function tryParseWithBabel(code: string){
  return babel
    .parseSync(code, { plugins: [babel_ts] })
    .program.body
}

export function tryReadFile(loc: string, basename?: string){
  if(basename)
    loc = path.resolve(loc, basename);

  if(!existsSync(loc))
    return null;

  if(!statSync(loc).isFile())
    throw new Error("Not a File");

  return readFileSync(loc, { encoding: "utf-8" })
}

export function tryReadJSON(loc: string, basename?: string){
  const contents = tryReadFile(loc, basename);
  
  if(!contents) 
    return null;

  try {
    return new Function(`return ${contents}`)()
  }
  catch(err){
    debugger
    return null;
  }
}

export function resolveMainTypes(root: string){
  const pkg = tryReadJSON(root, "package.json");
  const exists = (...segments: string[]) => {
    const uri = path.resolve(root, ...segments)
    return existsSync(uri) && uri;
  }

  if(!pkg)
    return {}

  let { types, main, name } = pkg;

  if(types)
    types = exists(types);

  else {
    const match = /^(.+?)(\.js)?$/.exec(main)!;

    types = exists(match[1] + ".d.ts");

    if(!types)
      types = exists(match[1], "index.d.ts")

    if(!types && match[2])
      types = exists(match[2], "index.d.ts")
  }

  if(!types)
    return {
      main: ""
    }

  return {
    name,
    main: types as string
  }
}