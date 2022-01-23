/**
 * Error may be imported in front-end code and
 * checked against a catch using `instanceof`. 
 */
export class CustomError extends Error {};

export class SuperCustomError extends CustomError {};

export async function willFail(): Promise<never> {
  throw new SuperCustomError("Goodbye cruel world!");
}

/**
 * Custom information will forwarded in the response
 * (ala-stacktrace) and be present on the client error.
 * 
 * Use a custom switch to access those custom values with intellisense enabled.
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