// import { hi } from "@entangled/api";
import { hello } from "./service";
import { hello as hi } from "./foobar";

window.onload = async () => {
  const response = await hello();
  void hi();
  
  console.log(`Server said: ${response}!`);
}