import path from "node:path";
import react from "@vitejs/plugin-react";
import { defineConfig } from "vitest/config";

export default defineConfig({
  plugins: [react()],
  resolve: {
    alias: {
      "@": path.resolve(__dirname, "src"),
      // graphql-yoga loads graphql's CJS build through Node; point our ESM
      // imports at the same file so both share one set of type instances.
      graphql: path.resolve(__dirname, "node_modules/graphql/index.js"),
    },
  },
  test: {
    include: ["src/**/*.test.{ts,tsx}"],
    // Component tests opt into jsdom with a `@vitest-environment jsdom` docblock.
    environment: "node",
    setupFiles: ["./src/test/setup.ts"],
    css: false,
    // Process the GraphQL server stack through Vite too, so it and our code
    // resolve `graphql` to the single aliased module above.
    server: { deps: { inline: [/graphql-yoga/, /@graphql-yoga\//, /@envelop\//, /@graphql-tools\//, /@whatwg-node\//] } },
  },
});
