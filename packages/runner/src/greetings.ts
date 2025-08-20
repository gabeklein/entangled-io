export async function hello(name: string): Promise<{ message: string }> {
  return { message: `Greetings, ${name}!` };
}