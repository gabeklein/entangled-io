import { useContext } from "@entangled/express";

export async function authorized(){
  /**
   * Just like react, you can make a custom hook
   * filling specific needs. If it needs to act
   * like middleware, simply make it async.
   */
  const { req } = useContext();

  const authorization = req.header('Authorization');

  if(!authorization)
    return false;

  return /^Bearer .+/.test(authorization);
}