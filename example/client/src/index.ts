import { Greetings, Error } from "@example/api";

window.onload = testHello;

export async function testHello(){
  const response =
    await Greetings.hello("Gabe", new Date("Jan 27"));

  alert(`Server said: ${response}!`);
}

export async function testErrors(){
  try {
    const response =
      await Error.willFailWithInfo("Hello Gabe!");

    alert(`Server said: ${response}!`);
  }
  catch(err){
    if(err instanceof Error.SpecialError){
      const { customInfo } = err;

      alert(`Request failed with special error.`);
      alert(`Special error has customInfo: ${customInfo}`)
    }

    if(err instanceof Error.SuperCustomError)
      alert(`Request failed with super custom error!`);

    if(err instanceof Error.CustomError)
      alert(`Request failed with special error!`);
  }
}