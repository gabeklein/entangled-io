import { hello } from "./hello";

function test(){
  let i = 0;

  setInterval(() => {
    hello(`#` + i++);
  }, 1500)
}

test();