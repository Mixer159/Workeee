import { fileURLToPath } from "node:url";
import { defineConfig } from "vitest/config";

const alias = [
  {
    find: /^@convex\//,
    replacement: fileURLToPath(new URL("./convex/", import.meta.url)),
  },
  {
    find: /^@\//,
    replacement: fileURLToPath(new URL("./src/", import.meta.url)),
  },
];

export default defineConfig({
  test: {
    projects: [
      {
        resolve: { alias },
        test: {
          name: "convex",
          include: ["convex/**/*.test.ts"],
          environment: "edge-runtime",
          server: { deps: { inline: ["convex-test"] } },
        },
      },
      {
        resolve: { alias },
        test: {
          name: "src",
          include: ["src/**/*.test.ts", "src/**/*.test.tsx"],
          environment: "node",
        },
      },
    ],
  },
});
