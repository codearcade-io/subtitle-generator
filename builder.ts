import { type BuildConfig } from "bun";

const entrypoints = ["src/index.ts"];

process.env.NODE_ENV = "production";

const defaultBuildConfig: BuildConfig = {
  entrypoints,
  outdir: "./dist",
  target: "node",
  format: "esm",
};

await Bun.build(defaultBuildConfig);
