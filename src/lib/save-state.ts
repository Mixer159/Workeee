/**
 * What a self-saving field reports while it writes. One screen renders one
 * indicator, so every autosaving control on it speaks the same four words.
 */
export type SaveState = "idle" | "saving" | "saved" | "error";
