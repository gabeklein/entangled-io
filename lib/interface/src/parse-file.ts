// const isComment = /^\/\//;
// const isImport = /^import (.+) from ['"'](.+)['"']/;

// const singleStatement = /^([^{]+?)[;$][ \t]*/

// async function parseFile(uri: string, name?: string){
//   let content = await tryReadFile(uri);

//   if(!content)
//     throw new Error(`Main types file not found for imported item${name ? ` ${name}` : ""}.`)

//   content = content
//     .replace(/\n\/\*([\s\S]*?)\*\//g, "")
//     .replace(/\n?\/\/.*[\t ]*/g, "")
//     .replace(/\s*\n\s*/g, " ");

//   const declared = {} as any;
//   const exported = {} as any;
//   const imported = {} as any;

//   while(content){
//     const match = singleStatement.exec(content);
//     if(match){
//       const [{ length }, statement] = match;
//       content = content.slice(length);

//       void statement
//       debugger;
//     }

//   }
  
//   debugger
//   void declared, imported;

//   return {
//     exported
//   }
// }