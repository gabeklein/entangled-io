export function hi(){
  return "Hello World!"
}

export async function hello(
  name: string,
  age: number,
  birthday: Date){

  await new Promise((resolve) => setTimeout(resolve, 1000));
  return `Hello ${name}!!`
}