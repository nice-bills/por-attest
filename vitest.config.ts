import { defineConfig } from "vitest/config";

// Workers load these as Text modules (wrangler.toml rules); tests need the same.
export default defineConfig({
  plugins: [
    {
      name: "text-modules",
      enforce: "pre",
      transform(code, id) {
        if (/\.(ya?ml|html)$/.test(id)) return { code: `export default ${JSON.stringify(code)}`, map: null };
      },
    },
  ],
  test: { include: ["test/**/*.test.ts"] },
});
