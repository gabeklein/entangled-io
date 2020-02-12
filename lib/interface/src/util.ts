import { existsSync, statSync, readFileSync } from "fs";
import path from "path";

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
  const pkg = tryReadJSON(root, "package.json")

  if(!pkg)
    throw new Error("No package JSON found :(")

  let { types, main, name } = pkg;

  if(!types){
    const match = /^(.+?)(\.js)?$/.exec(main);
    if(match){
      let relative = !match[2]
        ? path.join(match[1], "index.d.ts")
        : match[1] + ".d.ts";

      types = path.resolve(root, relative);
    }
  }
  else
    types = path.resolve(root, types);

  if(!existsSync(types))
    return {
      main: ""
    }

  return {
    name,
    main: types as string
  }
}

void function readPaths(root: string){
  let cfg = tryReadJSON(root, "tsconfig.json")

  if(!cfg)
    throw new Error(`Type accumulation expects a tsconfig.json at ${root}`)

  let uri = root;
  let paths = cfg.comilerOptions?.paths;

  if(!paths)
    while(!paths && cfg.extends){
      uri = path.dirname(path.resolve(root, cfg.extends));
      cfg = tryReadJSON(root, "tsconfig.json") || {};
      paths = cfg.compilerOptions?.paths;
    }

  if(paths)
    for(const alias in paths)
      paths[alias] = []
        .concat(paths[alias])
        .map(x => path.resolve(uri, x))

  return paths as BunchOf<string[]>;
}