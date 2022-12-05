/**
 * Hashing ("cyrb53") solution from stack-overflow. Avoids the use of `crypto`.
 * 
 * https://stackoverflow.com/a/52171480/877165
 */
 export function uniqueHash(str = "", length: number){
  const m32 = Math.imul;
  const x = 0x85ebca6b, y = 0xc2b2ae35;
  let h1 = 0xdeadbeef, h2 = 0x41c6ce57;

  for(let i = 0, ch; i < str.length; i++){
    ch = str.charCodeAt(i);
    h1 = m32(h1 ^ ch, 0x9e3779b1);
    h2 = m32(h2 ^ ch, 0x5f356495);
  }

  h1 = m32(h1 ^ (h1>>>16), x) ^ m32(h2 ^ (h2>>>13), y);
  h2 = m32(h2 ^ (h2>>>16), x) ^ m32(h1 ^ (h1>>>13), y);

  const out = 0x100000000 * (0x1fffff & h2) + (h1>>>0);

  return out.toString(16).substring(0, length).toUpperCase();
}