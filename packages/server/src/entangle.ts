#!/usr/bin/env node

import { watch } from ".";

function run(argv: any){
  const {
    _: [
      command,
      entryFile
    ]
  } = argv;

  if(command == "watch"){
    // const { hot, inspect } = argv;

    watch(entryFile);
  }
}

run(require("simple-argv"));