/**
 * Where everything sits on the two board captures in public/screenshots,
 * measured in the captures' own pixels (both are taken at twice the CSS
 * size). hero-board.tsx cuts the cards out of the very image the hero shows
 * and moves the cut-outs, so at rest nothing differs from the capture.
 */

/** x, y, width, height on a capture, in its pixels. */
export type Rect = readonly [number, number, number, number];

export type Move = {
  id: string;
  /** The column the task goes to: 0 To-do, 1 V průběhu, 2 Hotovo. */
  column: number;
  /** Its place there; "end" is after the last task, above "Přidat úkol". */
  index: number | "end";
};

export type BoardCapture = {
  name: "desktop" | "phone";
  /** The capture's path, to check that the image on screen is this one. */
  src: string;
  width: number;
  height: number;
  columns: {
    /** Left edge of the column's cards and the top of its first card. */
    x: number;
    top: number;
    /**
     * The task count beside the column name: a patch over it, and where a
     * new number is set (the start of its line and its baseline), fitted
     * to the capture's digits.
     */
    count: Rect;
    digit: readonly [number, number];
  }[];
  /** Between two cards of a column. */
  gap: number;
  /**
   * Every card and every "Přidat úkol" row, by its place on the capture.
   * A baked item already carries the app's fade at the right edge.
   */
  items: Record<string, { rect: Rect; card: boolean; baked?: boolean }>;
  /** Column by column, top to bottom, at rest; each ends with its "Přidat úkol" row. */
  start: string[][];
  /** The parts of the capture the cut-outs are laid over, in the board's own background. */
  covers: Rect[];
  /** One loop of the animation, in order. */
  moves: Move[];
  /** The phone board fades out towards the right edge between these two x. */
  fade?: readonly [number, number];
};

/** Width, then height, of a desktop card and of a "Přidat úkol" row. */
const DESK_W = 560;
const ADD_H = 90;

/** The board at 1216 px: To-do, V průběhu and Hotovo whole. */
export const DESKTOP: BoardCapture = {
  name: "desktop",
  src: "/screenshots/board.png",
  width: 2432,
  height: 1120,
  columns: [
    { x: 616, top: 346, count: [732, 274, 36, 32], digit: [736.75, 298.25] },
    { x: 1224, top: 346, count: [1394, 274, 36, 32], digit: [1398.75, 298.25] },
    { x: 1832, top: 346, count: [1964, 274, 36, 32], digit: [1968.75, 298.25] },
  ],
  gap: 16,
  items: {
    prepsat: { rect: [616, 346, DESK_W, 82], card: true },
    kontrast: { rect: [616, 444, DESK_W, 92], card: true },
    alt: { rect: [616, 552, DESK_W, 84], card: true },
    stranka404: { rect: [616, 652, DESK_W, 92], card: true },
    nadpisy: { rect: [616, 760, DESK_W, 120], card: true },
    logo: { rect: [616, 896, DESK_W, 82], card: true },
    "pridat-0": { rect: [616, 994, DESK_W, ADD_H], card: false },
    redesign: { rect: [1224, 346, DESK_W, 92], card: true },
    formular: { rect: [1224, 454, DESK_W, 92], card: true },
    galerie: { rect: [1224, 562, DESK_W, 92], card: true },
    "pridat-1": { rect: [1224, 670, DESK_W, ADD_H], card: false },
    staging: { rect: [1832, 346, DESK_W, 82], card: true },
    typografie: { rect: [1832, 444, DESK_W, 84], card: true },
    domena: { rect: [1832, 544, DESK_W, 82], card: true },
    layout: { rect: [1832, 642, DESK_W, 82], card: true },
    "pridat-2": { rect: [1832, 740, DESK_W, ADD_H], card: false },
  },
  start: [
    ["prepsat", "kontrast", "alt", "stranka404", "nadpisy", "logo", "pridat-0"],
    ["redesign", "formular", "galerie", "pridat-1"],
    ["staging", "typografie", "domena", "layout", "pridat-2"],
  ],
  covers: [[606, 336, 1796, 784]],
  // To-do first: an upright tablet crops the board to its first column.
  moves: [
    { id: "kontrast", column: 1, index: "end" },
    { id: "formular", column: 2, index: 0 },
    { id: "stranka404", column: 0, index: 0 },
    { id: "redesign", column: 2, index: 0 },
  ],
};

const PHONE_W = 496;
/** V průběhu runs off the phone capture's right edge; only this much of it is on it. */
const PEEK_W = 196;

/**
 * The board on a phone: To-do whole, V průběhu fading out at the right edge.
 * Its cards stay where they are; tasks from To-do join it at the bottom.
 */
export const PHONE: BoardCapture = {
  name: "phone",
  src: "/screenshots/board-mobile.png",
  width: 780,
  height: 1688,
  columns: [
    { x: 40, top: 442, count: [156, 370, 36, 31], digit: [161.25, 394.25] },
    { x: 584, top: 442, count: [754, 370, 26, 31], digit: [759.25, 394.25] },
  ],
  gap: 16,
  items: {
    prepsat: { rect: [40, 442, PHONE_W, 82], card: true },
    kontrast: { rect: [40, 540, PHONE_W, 92], card: true },
    alt: { rect: [40, 648, PHONE_W, 84], card: true },
    stranka404: { rect: [40, 748, PHONE_W, 92], card: true },
    nadpisy: { rect: [40, 856, PHONE_W, 120], card: true },
    logo: { rect: [40, 992, PHONE_W, 82], card: true },
    "pridat-0": { rect: [40, 1090, PHONE_W, ADD_H], card: false },
    redesign: { rect: [584, 442, PEEK_W, 92], card: true, baked: true },
    formular: { rect: [584, 550, PEEK_W, 92], card: true, baked: true },
    galerie: { rect: [584, 658, PEEK_W, 122], card: true, baked: true },
    "pridat-1": { rect: [584, 796, PEEK_W, ADD_H], card: false, baked: true },
  },
  start: [
    ["prepsat", "kontrast", "alt", "stranka404", "nadpisy", "logo", "pridat-0"],
    ["redesign", "formular", "galerie", "pridat-1"],
  ],
  covers: [
    [30, 432, 516, 1256],
    [574, 432, 206, 1256],
  ],
  moves: [
    { id: "kontrast", column: 1, index: "end" },
    { id: "stranka404", column: 0, index: 0 },
    { id: "alt", column: 1, index: "end" },
  ],
  fade: [650, 778],
};
