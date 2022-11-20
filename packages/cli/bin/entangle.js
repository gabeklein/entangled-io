#!/usr/bin/env node

const { serve } = require("../lib");

function run(argv){
  const {
    _: [ command, entry ],
    ...opts
  } = argv;

  if(command == "serve")
    serve(entry, opts);
}

run(require("simple-argv"));