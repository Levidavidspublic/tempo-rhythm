// Builds the kitchen polish gallery (entry.tsx) into <out>/gallery.js + index.html.
//   bun docs/kitchen/polish/gallery/build.ts <outDir> [devServerBase]
// The page links the app's compiled CSS from the running dev server, so the components are styled
// exactly as in the app (tokens, tempo.css, globals.css, Tailwind utilities). Not part of the app.
import { mkdir, writeFile } from "node:fs/promises";
import path from "node:path";

const here = import.meta.dir;
const repo = path.resolve(here, "../../../..");
const web = path.join(repo, "apps/web");
const out = path.resolve(process.argv[2] ?? path.join(here, "out"));
const base = process.argv[3] ?? "http://localhost:3000";

const stand = (file: string) => path.join(here, "mocks", file);
const fixed: Record<string, string> = {
  "convex/react": stand("convex-react.ts"),
  "@/convex/_generated/api": stand("api.ts"),
  "next/link": stand("next-link.tsx"),
  "next/navigation": stand("next-navigation.ts"),
  "@convex-dev/auth/react": stand("convex-auth-react.ts"),
  "@tempo/utils": path.join(repo, "packages/utils/src/index.ts"),
};

const result = await Bun.build({
  entrypoints: [path.join(here, "entry.tsx")],
  target: "browser",
  minify: false,
  define: { "process.env.NODE_ENV": JSON.stringify("production") },
  banner: "globalThis.process = globalThis.process || { env: { NODE_ENV: 'production' } };",
  plugins: [
    {
      name: "gallery-resolve",
      setup(build) {
        build.onResolve({ filter: /.*/ }, (args) => {
          if (fixed[args.path]) return { path: fixed[args.path] };
          if (args.path.startsWith("@/convex/")) return { path: Bun.resolveSync(`./${args.path.slice(9)}`, path.join(repo, "convex")) };
          if (args.path.startsWith("@/")) return { path: Bun.resolveSync(`./${args.path.slice(2)}`, web) };
          // The gallery's own bare imports (react, react-dom) come from the app's node_modules.
          if (args.importer.startsWith(here) && !args.path.startsWith(".") && !args.path.startsWith("/")) {
            return { path: Bun.resolveSync(args.path, web) };
          }
          return undefined;
        });
      },
    },
  ],
});
if (!result.success) {
  for (const log of result.logs) console.error(log);
  process.exit(1);
}
await mkdir(out, { recursive: true });
await writeFile(path.join(out, "gallery.js"), await result.outputs[0].text());

const html = await (await fetch(`${base}/sign-in`)).text();
const css = [...new Set(html.match(/\/_next\/static\/[^"]+\.css/g) ?? [])].map((href) => `<link rel="stylesheet" href="${base}${href}">`);
// next/font puts its font variables on <html> as classes: copy them so headings get Newsreader.
const htmlClass = html.match(/<html[^>]*class="([^"]*)"/)?.[1] ?? "";
await writeFile(
  path.join(out, "index.html"),
  `<!doctype html><html lang="en" class="${htmlClass}"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width, initial-scale=1">${css.join("")}<style>.gallery-main{padding-block:var(--tp-space-6)}</style></head><body><div id="root"></div><script src="gallery.js"></script></body></html>`,
);
console.log(`gallery: ${out}/index.html (${css.length} stylesheet(s) from ${base})`);
