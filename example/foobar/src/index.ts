/**
 * A "default" export is mapped to the root of a route!
 * 
 * You can call this directly, as `API.greetings()` as opposed to `API.greetings.default()`
 */
 export async function greetings(){
  return `Greetings lone traveller!`
}