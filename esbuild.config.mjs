import esbuild from "esbuild";
import process from "process";

const production = process.argv[2] === "production";

const context = await esbuild.context({
  entryPoints: ["src/main.ts"],
  bundle: true,
  external: ["obsidian", "electron", "@codemirror/view"],
  format: "cjs",
  target: "es2020",
  logLevel: "info",
  sourcemap: production ? false : "inline",
  treeShaking: true,
  outfile: "main.js",
  banner: {
    js: "var global = globalThis;"
  }
});

if (production) {
  await context.rebuild();
  await context.dispose();
  process.exit(0);
}

await context.watch();
console.log("[translator-for-obsidian] watching for changes");
