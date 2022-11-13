export function hello(name?: string){
  const greeting = `Hello ${name || "World"}!`;

  console.log(greeting);
  console.log(greeting + "!!");

  return greeting;
}

export function hi(){
  return "hoi!";
}

hello();