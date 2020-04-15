/**
 * A "default" export is mapped to the root of a route!
 * 
 * You can call this directly, as `API.greetings()` as opposed to `API.greetings.default()`
 */
export default function greetings(){
  return `Greetings lone traveller!`
}

/**
 * Callable as `API.greetings.hi()`
 */
export function hi(){
  return "Hello World!"
}

/**
 * Callable as `API.greetings.hello("Me", new Date("01/01/1970"))`
 */
export async function hello(
  name: string,
  birthday: Date){

  return `Hello ${name}!!`
}