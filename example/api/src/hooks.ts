import { useContext } from "@entangled/express";

export function authorized(){
  /**
   * Just like react, you can make a custom hook
   * filling specific needs. If it needs to act
   * like middleware, simple make it async.
   */
  const { req } = useContext();

  const authorization = req.header('Authorization');

  if(authorization && /^Bearer .+/.test(authorization))
    return true;
  else
    return false;
}