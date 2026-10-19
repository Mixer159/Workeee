import type { ReactNode } from "react";

/**
 * Props that open a link in a new tab when it leaves this site. Every
 * absolute http(s) address on this page points elsewhere (GitHub, the app,
 * the companies in the logo band); in-page anchors stay in the tab.
 */
export function externalProps(href: string) {
  return /^https?:\/\//.test(href) ? { target: "_blank", rel: "noopener noreferrer" } : {};
}

const BASE =
  "inline-flex shrink-0 items-center justify-center gap-3 rounded-control font-semibold whitespace-nowrap transition-[background-color,color] duration-200 ease-out";

const TONES = {
  solid: "bg-ink text-white hover:bg-[#2b2c32]",
  /** On the sky of the hero, where a white rectangle is the quiet choice. */
  white: "bg-white text-ink hover:bg-[#e8f0f8]",
};

const SIZES = {
  /** The height comes from the hero's own CSS, which scales it with the window. */
  hero: "px-5 text-[0.9375rem] md:px-6 md:text-base",
  md: "h-12 px-5 text-[0.9375rem]",
};

type ButtonLinkProps = {
  href: string;
  tone?: keyof typeof TONES;
  size?: keyof typeof SIZES;
  className?: string;
  children: ReactNode;
};

/** A link drawn as a button: a rectangle with the control radius. */
export function ButtonLink({
  href,
  tone = "solid",
  size = "md",
  className = "",
  children,
}: ButtonLinkProps) {
  return (
    <a href={href} {...externalProps(href)} className={`${BASE} ${TONES[tone]} ${SIZES[size]} ${className}`}>
      {children}
    </a>
  );
}

/** An inline action: label and icon, with an underline that darkens on hover. */
export function TextLink({
  href,
  className = "",
  children,
}: {
  href: string;
  className?: string;
  children: ReactNode;
}) {
  return (
    <a
      href={href}
      {...externalProps(href)}
      className={`inline-flex items-center gap-2 py-2.5 font-semibold whitespace-nowrap underline decoration-current/30 decoration-1 underline-offset-[6px] transition-[text-decoration-color] duration-200 ease-out hover:decoration-current ${className}`}
    >
      {children}
    </a>
  );
}
