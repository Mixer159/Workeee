/**
 * The emoji offered as project icons.
 *
 * A curated grid, not a full emoji keyboard: picking an icon for a project is a
 * two-second decision, and a searchable picker would be a dependency and a
 * second input on a dialog that has one field. The server does not know this
 * list — it validates the *shape* of what arrives (`normalizeEmoji` in
 * `convex/lib/validation.ts`), so the grid can grow without a deploy.
 */
export const PROJECT_EMOJIS = [
  "🚀", "📦", "🧩", "🎯", "📊", "📈", "🗂️", "📝",
  "💡", "🔧", "⚙️", "🛠️", "🧪", "🔍", "📌", "📅",
  "💬", "📣", "🎨", "🖌️", "🧭", "🏗️", "🏢", "🏭",
  "🛒", "💰", "🧾", "📮", "🤝", "👥", "🧠", "⭐",
  "🔥", "⚡", "🌍", "🌱", "🍀", "☕", "🎵", "🎬",
  "📷", "🖥️", "📱", "🔐", "🛡️", "🚚", "✈️", "🏁",
] as const;
