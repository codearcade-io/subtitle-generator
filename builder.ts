import { type BuildConfig } from "bun";

const entrypoints = ["src/index.ts"];

const defaultBuildConfig: BuildConfig = {
  entrypoints,
  outdir: "./dist",
  target: "node",
  format: "esm",
  external: ["inquirer", "unzipper"],
};

await Bun.build(defaultBuildConfig);
