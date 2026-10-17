import { tidy } from "@/lib/typography";

// A word with a one-letter prefix before a hyphen: "e-mail", "E-mailem".
const HYPHENATED = /((?<![\p{L}\p{N}])\p{L}-\p{L}+)/gu;

/**
 * Czech running text: tidy() for one-letter prepositions, and "e-mail" kept
 * on one line, because a browser may otherwise break it after the hyphen.
 */
export function Typo({ children }: { children: string }) {
  // split() with a capturing group puts the matches at the odd positions.
  return tidy(children)
    .split(HYPHENATED)
    .map((part, index) =>
      index % 2 === 1 ? (
        <span key={index} className="whitespace-nowrap">
          {part}
        </span>
      ) : (
        part
      ),
    );
}
