import { hi } from "@entangled/api";

window.onload = async () => {
  const response = await hi();
  
  console.log(`Server said: ${response}!`);
}