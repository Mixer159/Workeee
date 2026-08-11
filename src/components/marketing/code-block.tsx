/**
 * A real command, in the one register the page allows monospace: things a
 * person types or pastes. Comment lines are dimmed so the commands are what the
 * eye lands on.
 *
 * The spans are inline and the newline is a real character, not a `block`
 * display: this is a block somebody selects and pastes into a terminal, and the
 * two have to come out the same.
 */
export function CodeBlock({ lines }: { lines: string[] }) {
  return (
    <pre className="overflow-x-auto rounded-lg border border-border bg-card px-4 py-3.5 font-mono text-[0.8125rem] leading-[1.75]">
      <code>
        {lines.map((line, index) => (
          <span
            key={`${index}-${line}`}
            className={line.startsWith("#") ? "text-muted-foreground" : undefined}
          >
            {line}
            {index < lines.length - 1 ? "\n" : ""}
          </span>
        ))}
      </code>
    </pre>
  );
}
