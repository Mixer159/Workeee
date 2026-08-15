/**
 * The screenshots on the public page.
 *
 * Every one of them is the real application, photographed from a running
 * deployment with real (invented) people and real tasks in it. There are no
 * mock-ups on this page and no `div` pretending to be a product: the app and
 * the page share one palette and one typeface, which is what lets a capture sit
 * on the page without a frame around it announcing that it is a picture.
 *
 * All shots are in the light theme (Obloha). The dimensions are the files'
 * own, in device pixels: every desktop shot was taken at 1440 × 900 with a 2×
 * pixel ratio, the phone one at 390 wide. They live here so a component never
 * guesses an aspect ratio and so re-capturing means editing one file.
 */

export type Shot = {
  src: string;
  width: number;
  height: number;
  alt: string;
};

export const SHOTS = {
  board: {
    src: "/marketing/board.png",
    width: 2432,
    height: 1120,
    alt: "Nástěnka projektu Web pro Zátiší se sloupci To-do, V průběhu a Hotovo.",
  },
  drawer: {
    src: "/marketing/drawer.png",
    width: 2880,
    height: 1800,
    alt: "Nástěnka s otevřeným panelem úkolu Redesign úvodní sekce vpravo.",
  },
  prace: {
    src: "/marketing/prace.png",
    width: 2880,
    height: 1800,
    alt: "Pracovní režim: úkoly napříč projekty vlevo, otevřený detail úkolu uprostřed.",
  },
  palette: {
    src: "/marketing/palette.png",
    width: 2880,
    height: 1800,
    alt: "Příkazová paleta s posledními úkoly nad ztlumeným pracovním režimem.",
  },
  upozorneni: {
    src: "/marketing/upozorneni.png",
    width: 2880,
    height: 1800,
    alt: "Přehled upozornění: zmínka v komentáři od Marka u úkolu Galerie realizací s lazy loadingem.",
  },
  vzhledy: {
    src: "/marketing/vzhledy.png",
    width: 510,
    height: 780,
    alt: "Nabídka uživatele s výběrem šesti vzhledů od Oblohy po Švestku.",
  },
  editor: {
    src: "/marketing/editor.png",
    width: 1186,
    height: 1730,
    alt: "Popis úkolu s otevřenou nabídkou bloků po napsání lomítka.",
  },
  comments: {
    src: "/marketing/comments.png",
    width: 1182,
    height: 994,
    alt: "Vlákno komentářů pod úkolem se zmínkou konkrétního člověka.",
  },
  prehled: {
    src: "/marketing/prehled.png",
    width: 2880,
    height: 1800,
    alt: "Přehled projektů organizace jako karty.",
  },
  boardMobile: {
    src: "/marketing/board-mobile.png",
    width: 780,
    height: 1688,
    alt: "Nástěnka na telefonu.",
  },
} satisfies Record<string, Shot>;
