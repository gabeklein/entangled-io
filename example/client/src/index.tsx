import { greetings } from "@entangled/api";

window.onload = async () => {
  const response = await greetings();
  
  console.log(`Server said: ${response}`);
}