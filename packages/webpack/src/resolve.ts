const { create } = require("enhanced-resolve");

/** Customized webpack resolver to look for .d.ts files. */
const specialResolver = create.sync({
  extensions: [".d.ts"],
  mainFields: ["types", "main"],
  resolveToContext: false,
  symlinks: true
});

export function resolveTypes(
  context: string,
  resolve: string
){
  try {
    let resolved = specialResolver(context, resolve);
    return resolved.replace(/\/lib\/index\.[^\\\/]+$/, "");
  }
  catch(err){
    console.error(err);
    throw new Error("Couldn't find types");
  }
}