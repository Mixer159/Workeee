import localFont from "next/font/local";
import type { ReactNode } from "react";
import "./marketing.css";

/**
 * Urbanist carries the public page and nothing else, so it is declared here
 * rather than in the root layout: the app never downloads it. One variable
 * file covers the 90 px headline and the 15 px footer; it is subset to Latin
 * and Latin Extended, which covers Czech (licence in `fonts/Urbanist-OFL.txt`).
 */
const urbanist = localFont({
  src: "../fonts/Urbanist-Variable.woff2",
  variable: "--font-urbanist",
  weight: "100 900",
  display: "swap",
});

/**
 * The public shell for `/o-aplikaci` and `/zmeny`. Each page draws its own
 * bar and footer, because the bar's links are in-page anchors on the landing
 * page and lead back to it from everywhere else.
 *
 * `workeee-marketing` is what `marketing.css` hangs the page off: the font,
 * the ink and white ground, the focus ring and the document background behind
 * an overscroll bounce. The page has its own palette and does not follow the
 * visitor's app theme.
 */
export default function MarketingLayout({ children }: { children: ReactNode }) {
  return <div className={`workeee-marketing ${urbanist.variable}`}>{children}</div>;
}
