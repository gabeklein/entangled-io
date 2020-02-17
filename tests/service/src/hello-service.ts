
export default function greetings(){
  return `Greetings lone traveller!`
}

export function hi(){
  return "Hello World!"
}

export async function hello(
  name: string,
  age: number,
  birthday: Date){

  return `Hello ${name}!!`
}