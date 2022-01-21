import { Greetings } from "@example/api";

window.onload = async () => {
  const response = await Greetings.hi();
  
  console.log(`Server said: ${response}!`);
}