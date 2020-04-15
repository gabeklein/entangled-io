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
 * Callable as `API.greetings.hello("Me", new Date("01/01/1970"))`;
 * 
 * Working with dates is super easy with entanged. 👀
 */
export async function hello(
  name: string, birthday: Date){

  const today = new Date();
  let quote = `Hello ${name}!`

  if(today.getMonth() == birthday.getMonth()
  && today.getDate() == birthday.getDate()){
    quote += " Happy Birthday! 🥳🎁"
  }
  
  return quote;
}