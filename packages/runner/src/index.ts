export async function hello(name: string): Promise<{ message: string }> {
  return { message: `Hello, ${name}!` };
}

export async function goodbye(name: string): Promise<{ message: string }> {
  return { message: `Goodbye, ${name}!` };
}

export * as greetings from './greetings';