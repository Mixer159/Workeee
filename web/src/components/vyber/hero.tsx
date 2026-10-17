import Image, { getImageProps } from "next/image";
import { ArrowIcon, GitHubIcon } from "@/components/shared/icons";
import { PAINTING_QUALITY, PHOTOS } from "@/lib/photos";
import { tidy } from "@/lib/typography";
import { ACTIONS, HERO, LINKS, SHOTS } from "@/lib/workeee";
import { ButtonLink } from "./button-link";
import { HeroBoard } from "./hero-board";

/**
 * The board capture. From md up the desktop board, below it the phone board.
 * The two have different proportions, so the window sets the ratio (in CSS) and
 * the image fills it. One <img> inside <picture> means only the matching file
 * is downloaded, so it can load eagerly.
 */
function BoardPicture() {
  const desktop = getImageProps({
    src: SHOTS.board.src,
    alt: SHOTS.board.alt,
    width: SHOTS.board.width,
    height: SHOTS.board.height,
    sizes: "(min-width: 1024px) min(62vw, 68rem), 82vw",
    // Small interface text keeps its edges at 90; at the default 75 it smudges.
    quality: 90,
  });
  const phone = getImageProps({
    src: SHOTS.boardMobile.src,
    alt: SHOTS.boardMobile.alt,
    width: SHOTS.boardMobile.width,
    height: SHOTS.boardMobile.height,
    sizes: "17rem",
    quality: 90,
    loading: "eager",
    fetchPriority: "high",
  });

  return (
    <picture>
      <source media="(min-width: 768px)" srcSet={desktop.props.srcSet} sizes={desktop.props.sizes} />
      {/* A plain img inside the picture: next/image cannot switch between two sources. */}
      <img
        {...phone.props}
        alt={SHOTS.boardMobile.alt}
        className="absolute inset-0 block size-full object-cover object-left-top"
      />
    </picture>
  );
}

/**
 * Exactly one window tall. Layers, bottom to top: the landscape painting,
 * the white sheet that leaves it visible at the top and the sides, then text
 * and the board capture. The capture sits in a frame filled with a second,
 * closely related painting and runs off the hero's bottom edge. Tasks move
 * across it in a loop (HeroBoard); at rest it is the capture as it is.
 * The geometry is in `.hero` in vyber.css.
 */
export function Hero() {
  const photo = PHOTOS.poleMalba;

  return (
    <section id="top" className="hero" aria-labelledby="hero-title">
      <div className="hero-photo">
        {/* Only bands of it show around the sheet, so it need not match the window's width. */}
        <Image
          src={photo.src}
          alt={photo.alt}
          fill
          sizes="(min-width: 1024px) 75vw, 100vw"
          quality={PAINTING_QUALITY}
          loading="eager"
        />
      </div>
      <div className="hero-sheet" />

      <div className="hero-copy wrap">
        <h1 id="hero-title" className="hero-title rise">
          {HERO.headline.map((line) => (
            <span key={line} className="block">
              {tidy(line)}
            </span>
          ))}
        </h1>
        {/* The three claims. What the board holds is said once, in the statement below. */}
        <p className="hero-lead rise font-medium [--delay:80ms]">
          {HERO.claims.map((claim, index) => (
            <span key={claim}>
              {index > 0 && " "}
              {tidy(claim)}.
            </span>
          ))}
        </p>
        <div className="hero-actions rise [--delay:160ms]">
          <ButtonLink href={LINKS.repo} size="hero" className="hero-btn">
            <GitHubIcon className="size-5" />
            {ACTIONS.repo}
          </ButtonLink>
          <ButtonLink href="#nasazeni" tone="white" size="hero" className="hero-btn">
            {ACTIONS.deploy}
            <ArrowIcon className="size-[18px]" />
          </ButtonLink>
        </div>

        <div className="hero-slot">
          <div className="hero-capture">
            <div className="hero-mat">
              {/* The largest element of the first screen (LCP), though only its rim
                  shows around the board: loaded first, and no larger than that rim needs. */}
              <Image
                src={PHOTOS.planMalba.src}
                alt=""
                fill
                sizes="(min-width: 768px) 50vw, 60vw"
                quality={PAINTING_QUALITY}
                loading="eager"
                fetchPriority="high"
              />
            </div>
            <div className="hero-frame">
              <HeroBoard className="hero-window">
                <BoardPicture />
              </HeroBoard>
            </div>
          </div>
        </div>
      </div>

      {/* The page below starts as a white sheet with rounded top corners, so the
          bands of painting at the sides turn into it instead of ending square. */}
      <div className="hero-foot" aria-hidden="true" />
    </section>
  );
}
