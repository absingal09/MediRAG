import react from "@vitejs/plugin-react";
import { defineConfig } from "vite";
import { readFileSync } from "node:fs";
import { createHash } from "node:crypto";
import { resolve, dirname } from "node:path";
import { fileURLToPath } from "node:url";
import type { Plugin } from "vite";
const root = dirname(fileURLToPath(import.meta.url));
const corpus = resolve(root, "../data/pdfs");
// Only the allowlisted corpus is served, never .env or arbitrary repository paths.
function corpusPlugin(): Plugin {
  const csv = readFileSync(resolve(root, "../data/sources.csv"), "utf8")
    .trim()
    .split(/\r?\n/)
    .slice(1);
  const shortTitles: Record<string, string> = {
    STW_DKA: "DKA",
    STW_NSTEMI: "UA / NSTEMI",
    STW_STEMI: "STEMI",
    STW_Diabetes_Type2: "Type 2 diabetes",
    STW_Sepsis_Children: "Paediatric sepsis",
    STW_Dengue: "Dengue",
    STW_GI_Bleed: "GI bleed",
  };
  const entries = csv.map((line) => {
    const [file, title, edition, sourceUrl] = line.split(",");
    const id = file.replace(/\.pdf$/, "");
    return {
      id,
      file,
      title,
      shortTitle: shortTitles[id] || title,
      edition,
      sourceUrl,
      pages: id === "STW_Acute_Aortic_Syndrome" ? 2 : 1,
      size: readFileSync(resolve(corpus, file)).byteLength,
    };
  });
  const sourceLocations = JSON.parse(
    readFileSync(resolve(root, "src/generated/sourceLocations.json"), "utf8"),
  );
  for (const entry of entries) {
    const hash = createHash("sha256")
      .update(readFileSync(resolve(corpus, entry.file)))
      .digest("hex");
    if (sourceLocations.files[entry.id] !== hash) {
      throw new Error(
        `PDF location index is stale for ${entry.file}. From the repo root run: .venv/Scripts/python frontend/scripts/build_source_locations.py`,
      );
    }
  }
  return {
    name: "medirag-corpus",
    resolveId(id) {
      if (id === "virtual:guidelines") return "\0virtual:guidelines";
    },
    load(id) {
      if (id === "\0virtual:guidelines")
        return `export default ${JSON.stringify(entries)}`;
    },
    configureServer(server) {
      server.middlewares.use((req, res, next) => {
        if (!req.url?.startsWith("/documents/")) return next();
        let file: string;
        try {
          file = decodeURIComponent(
            req.url.split("?")[0].slice("/documents/".length),
          );
        } catch {
          res.statusCode = 400;
          res.end();
          return;
        }
        if (!entries.some((item) => item.file === file)) {
          res.statusCode = 404;
          res.end("Document not found");
          return;
        }
        res.setHeader("Content-Type", "application/pdf");
        res.setHeader("Cache-Control", "public, max-age=3600");
        res.end(readFileSync(resolve(corpus, file)));
      });
    },
    generateBundle() {
      for (const entry of entries)
        this.emitFile({
          type: "asset",
          fileName: `documents/${entry.file}`,
          source: readFileSync(resolve(corpus, entry.file)),
        });
    },
  };
}

// https://vite.dev/config/
export default defineConfig({
  plugins: [react(), corpusPlugin()],
  server: {
    host: "127.0.0.1",
    port: 5173,
    strictPort: true,
    proxy: {
      "/api": {
        target: process.env.MEDIRAG_API_TARGET || "http://127.0.0.1:8000",
        changeOrigin: true,
        rewrite: (path) => path.replace(/^\/api/, ""),
      },
    },
  },
});
