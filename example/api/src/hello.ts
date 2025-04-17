/**
 * Callable as `API.greetings.hi()`
 */
export async function hi(name = "World") {
  return `Hello ${name}!`
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