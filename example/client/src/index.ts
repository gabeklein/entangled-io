import { Errors } from "@example/api";

window.onload = async () => {
  try {
    const response =
      await Errors.willFailWithInfo("Hello Gabe!");

    alert(`Server said: ${response}!`);
  }
  catch(err){
    if(err instanceof Errors.SpecialError){
      const { customInfo } = err;

      alert(`Request failed with special error.`);
      alert(`Special error has customInfo: ${customInfo}`)
    }

    if(err instanceof Errors.SuperCustomError)
      alert(`Request failed with super custom error!`);

    if(err instanceof Errors.CustomError)
      alert(`Request failed with special error!`);
  }
}