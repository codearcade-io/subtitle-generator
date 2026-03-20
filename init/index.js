import inquirer from "inquirer";
import path from "path";
import fs from "fs";
import os from "os";
import { execSync } from "child_process";
import { Readable } from "stream";
import { pipeline } from "stream/promises";
import unzipper from "unzipper";

const init = async () => {
  const { modelSize } = await inquirer.prompt([
    {
      type: "list",
      name: "modelSize",
      message: "Which Whisper model do you want to download?",
      choices: [
        { name: "Small  — fast, lower accuracy", value: "small" },
        { name: "Medium — balanced", value: "medium" },
        { name: "Large  — slow, highest accuracy", value: "large" },
      ],
      default: "small",
    },
  ]);

  const modelUrls = {
    small:
      "https://huggingface.co/ggerganov/whisper.cpp/resolve/main/ggml-small.bin",
    medium:
      "https://huggingface.co/ggerganov/whisper.cpp/resolve/main/ggml-medium.bin",
    large:
      "https://huggingface.co/ggerganov/whisper.cpp/resolve/main/ggml-large-v3.bin",
  };

  const modelUrl = modelUrls[modelSize];

  // Helper function to download both models and zip files
  async function downloadFile(url, dest, label) {
    if (fs.existsSync(dest)) {
      console.log(`${label} already exists at ${dest}`);
      return;
    }

    console.log(`Downloading ${label}...`);
    const res = await fetch(url, {
      redirect: "follow",
      headers: {
        "User-Agent": "node",
      },
    });

    const contentType = res.headers.get("content-type");

    if (!contentType || !contentType.includes("application")) {
      throw new Error(
        `Invalid response. Expected binary file but got: ${contentType}`,
      );
    }

    if (!res.ok) {
      throw new Error(`Failed to download: ${res.statusText}`);
    }

    const total = Number(res.headers.get("content-length")) || 0;
    let downloaded = 0;

    const fileStream = fs.createWriteStream(dest);

    const nodeStream = Readable.fromWeb(res.body);

    nodeStream.on("data", (chunk) => {
      downloaded += chunk.length;
      if (total) {
        const percent = ((downloaded / total) * 100).toFixed(2);
        process.stdout.write(`Downloading ${label}... ${percent}%\r`);
      }
    });

    await pipeline(nodeStream, fileStream);

    const stats = fs.statSync(dest);

    if (stats.size < 100000) {
      throw new Error(
        `Downloaded file too small (${stats.size} bytes). Likely HTML instead of ZIP.`,
      );
    }

    console.log(`\n${label} download complete.`);
  }

  // 1. Download the AI Model
  const modelsDir = path.join(process.cwd(), "models");
  if (!fs.existsSync(modelsDir)) {
    fs.mkdirSync(modelsDir, { recursive: true });
  }
  const destModelPath = path.join(modelsDir, path.basename(modelUrl));
  await downloadFile(modelUrl, destModelPath, `${modelSize} model`);

  // 2. Setup the Binary based on OS
  console.log("\nSetting up whisper.cpp binary...");
  const platform = os.platform();
  const whisperDir = path.join(process.cwd(), "whisper");
  const isWindows = platform === "win32";

  if (!fs.existsSync(whisperDir)) {
    fs.mkdirSync(whisperDir, { recursive: true });
  }

  if (isWindows) {
    const binaryDest = path.join(whisperDir, "whisper-cli.exe");

    if (!fs.existsSync(binaryDest)) {
      console.log("Detecting Windows architecture...");
      const arch = os.arch();

      let zipName;

      if (arch === "x64") {
        zipName = "whisper-bin-x64.zip";
      } else if (arch === "ia32") {
        zipName = "whisper-bin-Win32.zip";
      } else if (arch === "arm64") {
        console.log("ARM64 detected → using x64 binary via emulation...");
        zipName = "whisper-bin-x64.zip";
      } else {
        throw new Error(`Unsupported architecture: ${arch}`);
      }

      const zipUrl = `https://github.com/ggml-org/whisper.cpp/releases/download/v1.8.4/${zipName}`;
      const zipPath = path.join(whisperDir, "whisper.zip");

      await downloadFile(zipUrl, zipPath, `Whisper Windows Binary (${arch})`);

      // ✅ sanity check
      const stats = fs.statSync(zipPath);
      if (stats.size < 1_000_000) {
        throw new Error(`Downloaded ZIP too small (${stats.size} bytes)`);
      }

      console.log("Extracting binary (unzipper)...");

      await new Promise((resolve, reject) => {
        fs.createReadStream(zipPath)
          .pipe(unzipper.Parse())
          .on("entry", (entry) => {
            const filePath = path.join(whisperDir, entry.path);

            if (entry.type === "Directory") {
              fs.mkdirSync(filePath, { recursive: true });
              entry.autodrain();
            } else {
              fs.mkdirSync(path.dirname(filePath), { recursive: true });

              entry.pipe(fs.createWriteStream(filePath));
            }
          })
          .on("close", resolve)
          .on("error", reject);
      });

      // 🔍 Handle "Release" folder
      const releaseDir = path.join(whisperDir, "Release");

      if (fs.existsSync(releaseDir)) {
        const files = fs.readdirSync(releaseDir);

        for (const file of files) {
          fs.renameSync(
            path.join(releaseDir, file),
            path.join(whisperDir, file),
          );
        }

        fs.rmSync(releaseDir, { recursive: true, force: true });
      }

      // ✅ cleanup zip
      fs.unlinkSync(zipPath);

      console.log(`Whisper binary setup complete for Windows (${arch}).`);
    } else {
      console.log("Whisper binary already exists for Windows.");
    }
  } else {
    // Mac / Linux Setup
    const binaryDest = path.join(whisperDir, "whisper");
    if (!fs.existsSync(binaryDest)) {
      console.log("Mac/Linux detected. Building whisper.cpp from source...");
      console.log(
        "Note: This requires 'git', 'make', and a C/C++ compiler (gcc/clang).",
      );

      const repoDir = path.join(whisperDir, "source");
      if (!fs.existsSync(repoDir)) {
        // Shallow clone to save time and bandwidth
        execSync(
          `git clone --depth 1 https://github.com/ggml-org/whisper.cpp.git "${repoDir}"`,
          { stdio: "inherit" },
        );
      }

      console.log("Compiling... This might take a minute.");
      // Compile only the main CLI tool
      execSync(`cd "${repoDir}" && make main`, { stdio: "inherit" });

      const compiledPath = path.join(repoDir, "main");
      if (fs.existsSync(compiledPath)) {
        fs.copyFileSync(compiledPath, binaryDest);
        execSync(`chmod +x "${binaryDest}"`);
        console.log("Whisper binary compiled and configured successfully.");
      } else {
        console.error(
          "Error: Could not find the compiled binary. Compilation might have failed.",
        );
      }
    } else {
      console.log("Whisper binary already exists.");
    }
  }
};

export default init;
