/**
 * Error may be imported in front-end code and
 * checked against a catch using `instanceof` to
 * do different things. 
 */
export class CustomError extends Error {};

export class SuperCustomError extends CustomError {};

export async function willFail(): Promise<never> {
  throw new SuperCustomError("Goodbye cruel world!");
}

/**
 * Entangled will forward your custom metadata in the response.
 * It'll be present (along with stack track) on clientside error.
 * 
 * Use an if-statement to access those values with intellisense enabled.
 * 
 * ```
 * if(err instanceof SpecialError){
 *   alert(err.customInfo);
 * }
 * ```
 */
export class SpecialError extends Error {
  public customInfo: 42;

  constructor(message: string, public info: any){
    super(message);
    this.customInfo = info;
  }
};

export async function willFailWithInfo(info: any): Promise<never> {
  throw new SpecialError("Goodbye cruel world!", info);
}