import { hello } from "./service";

window.onload = async () => {
  const response = await hello();
  
  console.log(`Server said: ${response}!`);
}