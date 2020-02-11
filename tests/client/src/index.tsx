import { greetings } from "@entangled/service"

window.onload = async () => {
  void greetings.hi();
}