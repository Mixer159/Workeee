/**
 * The Workeee mark: three bars for the three statuses every project starts
 * with, and one detached card above the shortest bar. Drawn in `currentColor`
 * so it takes the colour of whatever it sits next to. Same geometry as the
 * app's own mark.
 */
export function Mark({ className }: { className?: string }) {
  return (
    <svg
      viewBox="0 0 48 44"
      aria-hidden="true"
      focusable="false"
      fill="currentColor"
      className={className}
    >
      <rect x="0" y="0" width="12" height="44" rx="3" />
      <rect x="18" y="14" width="12" height="30" rx="3" />
      <rect x="36" y="28" width="12" height="16" rx="3" />
      <rect x="36" y="10" width="12" height="10" rx="3" />
    </svg>
  );
}
