import { Errors } from "@example/api";

window.onload = async () => {
  try {
    const response = await Errors.willFailWithInfo("foobar!!");

    console.log(`Server said: ${response}!`);
  }
  catch(err){
    if(err instanceof Errors.SpecialError){
      const { customInfo } = err;

      console.log(`Request failed with special error.`);
      console.log(`Special error has customInfo: ${customInfo}`)
    }

    if(err instanceof Errors.SuperCustomError)
      console.log(`Request failed with super custom error!`);

    if(err instanceof Errors.CustomError)
      console.log(`Request failed with special error!`);
  }
}