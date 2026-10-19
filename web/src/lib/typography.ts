// Czech typography: a one-letter preposition or conjunction (a, i, o, u, k,
// s, v, z) must not end a line. Replacing the space after it with a
// non-breaking one keeps it attached to the next word at every screen width.
export function tidy(text: string) {
  return text.replace(/(?<=^|[\s(„])([aiouksvz])\s+/gi, "$1 ");
}
