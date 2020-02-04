import * as lol from "./hello-advanced"

export function hi(){
  return "Hello World!"
}

export async function hello(name: string){
  await new Promise((resolve) => setTimeout(resolve, 1000));
  return `Hello ${name}!!`
}

export { lol }