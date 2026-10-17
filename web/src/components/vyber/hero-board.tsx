"use client";

import { JetBrains_Mono } from "next/font/google";
import { useEffect, useMemo, useRef, useState, useSyncExternalStore, type CSSProperties, type ReactNode } from "react";
import { DESKTOP, PHONE, type BoardCapture, type Move, type Rect } from "./hero-board-captures";

// The app sets its task counts in JetBrains Mono. Only the moving board uses
// it here, so it is not preloaded: it loads once that layer is drawn.
const countFont = JetBrains_Mono({ subsets: ["latin"], weight: "400", display: "block", preload: false });

/** The hero shows the desktop capture from this width up (see BoardPicture). */
const WIDE = "(min-width: 768px)";

function subscribeWide(onChange: () => void) {
  const query = window.matchMedia(WIDE);
  query.addEventListener("change", onChange);
  return () => query.removeEventListener("change", onChange);
}

function subscribeVisibility(onChange: () => void) {
  document.addEventListener("visibilitychange", onChange);
  return () => document.removeEventListener("visibilitychange", onChange);
}

type Action =
  | { type: "show" }
  | { type: "lift"; id: string }
  | { type: "place"; move: Move }
  | { type: "drop" }
  | { type: "clear" }
  | { type: "hide" }
  | { type: "reset" };

type Step = { wait: number; action: Action };

type BoardState = {
  step: number;
  order: string[][];
  lifted: string | null;
  /** The layer is on screen; at rest it is not, and the capture shows. */
  shown: boolean;
  /** The cut-outs are visible; off, the layer is an empty board. */
  cards: boolean;
  /** Tasks per column as the headers show them; they change when a card lands. */
  counts: number[];
};

/** Every column ends with its "Přidat úkol" row, which is not a task. */
const countTasks = (order: string[][]) => order.map((column) => column.length - 1);

/**
 * One loop. The layer of cut-outs appears (it looks exactly like the capture
 * under it), each move lifts a card, carries it while the columns make room
 * and close up, and sets it down. After the last one the cards fade from the
 * board, the capture fades back in under them as it was, the cut-outs return
 * to their places while unseen, and it repeats. Fading the two arrangements
 * into each other instead would lay one set of titles over the other.
 */
function script(capture: BoardCapture): Step[] {
  const steps: Step[] = [{ wait: 1000, action: { type: "show" } }];
  capture.moves.forEach((move, index) => {
    steps.push({ wait: index === 0 ? 500 : 1500, action: { type: "lift", id: move.id } });
    steps.push({ wait: 180, action: { type: "place", move } });
    steps.push({ wait: 720, action: { type: "drop" } });
  });
  steps.push({ wait: 2600, action: { type: "clear" } });
  steps.push({ wait: 550, action: { type: "hide" } });
  steps.push({ wait: 600, action: { type: "reset" } });
  return steps;
}

function moveTask(order: string[][], { id, column, index }: Move) {
  const next = order.map((ids) => ids.filter((item) => item !== id));
  const target = next[column];
  target.splice(index === "end" ? target.length - 1 : index, 0, id);
  return next;
}

function apply(capture: BoardCapture, state: BoardState, action: Action): BoardState {
  switch (action.type) {
    case "show":
      return { ...state, shown: true };
    case "lift":
      return { ...state, lifted: action.id };
    case "place":
      return { ...state, order: moveTask(state.order, action.move) };
    case "drop":
      return { ...state, lifted: null, counts: countTasks(state.order) };
    case "clear":
      return { ...state, cards: false };
    case "hide":
      return { ...state, shown: false };
    case "reset":
      return { ...state, order: capture.start, counts: countTasks(capture.start), cards: true };
  }
}

/** Where every item stands for a given order: columns stack their items with the gap between. */
function positions(capture: BoardCapture, order: string[][]) {
  const at = new Map<string, readonly [number, number]>();
  order.forEach((ids, column) => {
    const { x, top } = capture.columns[column];
    let y = top;
    for (const id of ids) {
      at.set(id, [x, y]);
      y += capture.items[id].rect[3] + capture.gap;
    }
  });
  return at;
}

const box = ([x, y, w, h]: Rect) => ({ "--x": x, "--y": y, "--w": w, "--h": h }) as CSSProperties;

/**
 * A cut-out reaches this far past its card on every side, in capture pixels,
 * so a clip edge that lands between two screen pixels never shaves the
 * card's border. The margin is the board's own background.
 */
const MARGIN = 2;

/**
 * The cut-outs over one capture. Everything is in the capture's pixels and
 * scaled by --kx and --ky, so the layer follows the image at any size.
 */
function BoardStage({ capture, src, playing }: { capture: BoardCapture; src: string; playing: boolean }) {
  const steps = useMemo(() => script(capture), [capture]);
  const [state, setState] = useState<BoardState>(() => ({
    step: 0,
    order: capture.start,
    lifted: null,
    shown: false,
    cards: true,
    counts: countTasks(capture.start),
  }));

  // One step at a time, so a paused loop simply waits on its current step.
  useEffect(() => {
    if (!playing) return;
    const step = steps[state.step];
    const timer = setTimeout(
      () =>
        setState((current) => ({
          ...apply(capture, current, step.action),
          step: (current.step + 1) % steps.length,
        })),
      step.wait,
    );
    return () => clearTimeout(timer);
  }, [capture, playing, state.step, steps]);

  const at = positions(capture, state.order);
  const rest = countTasks(capture.start);

  const sprite = (id: string) => {
    const item = capture.items[id];
    const [x, y] = at.get(id) ?? [item.rect[0], item.rect[1]];
    const [sx, sy, w, h] = item.rect;
    const lifted = state.lifted === id;
    // Fade a card once it leaves its first column, from the moment it is
    // picked up: the mask changes how it is drawn, so cards at rest go without.
    const faded = Boolean(capture.fade) && !item.baked && (lifted || x !== capture.columns[0].x);
    return (
      <span
        key={id}
        className="board-sprite"
        data-lifted={lifted}
        data-fade={faded}
        style={
          {
            "--sx": sx - MARGIN,
            "--sy": sy - MARGIN,
            "--w": w + 2 * MARGIN,
            "--h": h + 2 * MARGIN,
            "--x": x - MARGIN,
            "--y": y - MARGIN,
          } as CSSProperties
        }
      >
        <span className="board-card" data-card={item.card}>
          {/* The whole picture again, laid out exactly as the one under it and
              shifted back by as much as the cut-out is shifted, so its pixels
              match the picture's at rest. */}
          {/* eslint-disable-next-line @next/next/no-img-element -- the file next/image already chose */}
          <img src={src} alt="" draggable={false} />
        </span>
      </span>
    );
  };

  const ids = Object.keys(capture.items);
  const changed = (column: number) => state.counts[column] !== rest[column];

  return (
    <div
      aria-hidden="true"
      className="board-stage"
      data-shown={state.shown}
      data-cards={state.cards}
      style={
        {
          "--cw": capture.width,
          "--ch": capture.height,
          ...(capture.fade && { "--fade-from": capture.fade[0], "--fade-to": capture.fade[1] }),
        } as CSSProperties
      }
    >
      {capture.covers.map((rect) => (
        <span key={rect.join()} className="board-cover" style={box(rect)} />
      ))}
      {capture.columns.map((column, index) => (
        <span key={index} className="board-count" data-shown={changed(index)} style={box(column.count)} />
      ))}
      {/* Baked cut-outs carry the phone's edge fade in their pixels already. */}
      {ids.filter((id) => capture.items[id].baked).map(sprite)}
      {ids.filter((id) => !capture.items[id].baked).map(sprite)}
      {capture.columns.map((column, index) => (
        <span
          key={index}
          className={`board-digit ${countFont.className}`}
          data-shown={changed(index)}
          data-fade={Boolean(capture.fade)}
          style={{ "--x": column.digit[0], "--y": column.digit[1] } as CSSProperties}
        >
          {/* Keyed by the number, so each new one rolls in. */}
          <span key={state.counts[index]}>{state.counts[index]}</span>
        </span>
      ))}
    </div>
  );
}

/**
 * The hero's board window, in motion: tasks move between the columns, the
 * way a card is dragged in the app. The capture itself stays the picture
 * (server-rendered, with its alt text); over it lies a layer of cards cut out
 * of the same image, which moves and, at the end of each loop, fades back to
 * the capture. The loop runs only while the board is on screen and the tab
 * is visible, and it does not wait for prefers-reduced-motion: the owner has
 * animation effects off and wants to see it.
 */
export function HeroBoard({ className, children }: { className: string; children: ReactNode }) {
  const frame = useRef<HTMLDivElement>(null);
  const wide = useSyncExternalStore(subscribeWide, () => window.matchMedia(WIDE).matches, () => null);
  const visible = useSyncExternalStore(
    subscribeVisibility,
    () => document.visibilityState === "visible",
    () => false,
  );
  const [src, setSrc] = useState<string | null>(null);
  const [onScreen, setOnScreen] = useState(false);

  // The file the picture actually shows (its size depends on the screen), so
  // the cut-outs come from the same pixels. A new one loads when the picture
  // switches between the phone and the desktop capture.
  useEffect(() => {
    const img = frame.current?.querySelector("img");
    if (!img) return;
    const read = () => setSrc(img.currentSrc || null);
    img.addEventListener("load", read);
    const pending = img.complete ? requestAnimationFrame(read) : 0;
    return () => {
      img.removeEventListener("load", read);
      cancelAnimationFrame(pending);
    };
  }, []);

  useEffect(() => {
    const element = frame.current;
    if (!element) return;
    const observer = new IntersectionObserver(([entry]) => setOnScreen(entry.isIntersecting), { threshold: 0.15 });
    observer.observe(element);
    return () => observer.disconnect();
  }, []);

  const capture = wide === null ? null : wide ? DESKTOP : PHONE;
  // Only once the picture shows this capture's file (next/image encodes the path).
  const ready = capture && src && decodeURIComponent(src).includes(capture.src);

  return (
    <div ref={frame} className={className}>
      {children}
      {ready && <BoardStage key={`${capture.name} ${src}`} capture={capture} src={src} playing={onScreen && visible} />}
    </div>
  );
}
