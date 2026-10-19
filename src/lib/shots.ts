/**
 * The screenshots on the public page.
 *
 * Every one of them is the real application, photographed from a running
 * deployment with real (invented) people and real tasks in it. The dimensions
 * are the files' own, in device pixels: desktop shots were taken at 1440 × 900
 * with a 2× pixel ratio, the phone one at 390 wide, all in the light Obloha
 * theme. The five `feature*` files are tighter crops of single screens. They
 * live here so a component never guesses an aspect ratio and so re-capturing
 * means editing one file.
 */

export type Shot = {
  src: string;
  width: number;
  height: number;
  alt: string;
};

export const SHOTS = {
  board: {
    src: "/marketing/screenshots/board.png",
    width: 2432,
    height: 1120,
    alt: "Nástěnka projektu Web pro Zátiší se sloupci To-do, V průběhu a Hotovo.",
  },
  boardMobile: {
    src: "/marketing/screenshots/board-mobile.png",
    width: 780,
    height: 1688,
    alt: "Nástěnka na telefonu.",
  },
  drawer: {
    src: "/marketing/screenshots/drawer.png",
    width: 2880,
    height: 1800,
    alt: "Nástěnka s otevřeným panelem úkolu Redesign úvodní sekce vpravo.",
  },
  comments: {
    src: "/marketing/screenshots/comments.png",
    width: 1182,
    height: 994,
    alt: "Vlákno komentářů pod úkolem se zmínkou konkrétního člověka.",
  },
  featureStavy: {
    src: "/marketing/screenshots/features/stavy.png",
    width: 1792,
    height: 1120,
    alt: "Nástěnka projektu se sloupci To-do, V průběhu a Hotovo.",
  },
  featureRole: {
    src: "/marketing/screenshots/features/role.png",
    width: 1456,
    height: 894,
    alt: "Seznam členů organizace s rolemi a rozsahem přístupu.",
  },
  featurePozvanky: {
    src: "/marketing/screenshots/features/pozvanky.png",
    width: 1456,
    height: 698,
    alt: "Seznam pozvánek s kódem, stavem a datem vypršení.",
  },
  featureUpozorneni: {
    src: "/marketing/screenshots/features/upozorneni-2.png",
    width: 1300,
    height: 812,
    alt: "Stránka Upozornění se zmínkou v komentáři.",
  },
  featureVzhledy: {
    src: "/marketing/screenshots/features/vzhledy-2.png",
    width: 701,
    height: 705,
    alt: "Výběr ze šesti barevných vzhledů aplikace.",
  },
} satisfies Record<string, Shot>;
