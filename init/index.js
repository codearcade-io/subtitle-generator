import inquirer from "inquirer";
import path from "path";
import fs from "fs";
import os from "os";
import { execSync } from "child_process";

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
    const res = await fetch(url);

    if (!res.ok) throw new Error(`Failed to download: ${res.statusText}`);

    const total = Number(res.headers.get("content-length")) || 0;
    let downloaded = 0;

    const file = fs.createWriteStream(dest);

    // Wait for both the pipeTo AND the file stream to fully close
    // so the file handle is released before we try to use the file.
    await new Promise((resolve, reject) => {
      file.on("close", resolve);
      file.on("error", reject);

      res.body.pipeTo(
        new WritableStream({
          write(chunk) {
            downloaded += chunk.length;
            if (total) {
              const percent = ((downloaded / total) * 100).toFixed(2);
              process.stdout.write(`Downloading ${label}... ${percent}%\r`);
            } else {
              process.stdout.write(`Downloaded ${downloaded} bytes\r`);
            }
            file.write(chunk);
          },
          close() {
            file.end(); // triggers 'close' event on the file stream once flushed
            console.log(`\n${label} download complete.`);
          },
          abort(err) {
            file.destroy(err);
            reject(err);
          },
        }),
      ).catch(reject);
    });
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
    // Windows Setup
    const binaryDest = path.join(whisperDir, "whisper-cli.exe");
    if (!fs.existsSync(binaryDest)) {
      console.log("Detecting Windows architecture...");
      const arch = os.arch(); // Usually 'x64', 'ia32', or 'arm64'

      let zipName;

      if (arch === "x64") {
        zipName = "whisper-bin-x64.zip";
      } else if (arch === "ia32") {
        zipName = "whisper-bin-Win32.zip";
      } else if (arch === "arm64") {
        // Windows ARM can emulate x64 executables
        console.log(
          "ARM64 architecture detected. Using x64 binary via Windows emulation...",
        );
        zipName = "whisper-bin-x64.zip";
      } else {
        throw new Error(
          `Unsupported Windows architecture: ${arch}. Whisper.cpp does not provide pre-compiled binaries for this system.`,
        );
      }

      const zipUrl = `https://github.com/ggml-org/whisper.cpp/releases/download/v1.8.4/${zipName}`;
      const zipPath = path.join(whisperDir, "whisper.zip");

      await downloadFile(zipUrl, zipPath, `Whisper Windows Binary (${arch})`);

      console.log("Extracting binary...");

      let extractionSuccess = false;
      let maxRetries = 5;
      let retryDelay = 1000; // 1 second

      // 1. The Retry Loop for safe extraction
      for (let attempt = 1; attempt <= maxRetries; attempt++) {
        try {
          execSync(
            `powershell -command "Expand-Archive -Force -LiteralPath '${zipPath}' -DestinationPath '${whisperDir}'"`,
            { stdio: "inherit" },
          );
          extractionSuccess = true;
          break; // It worked! Break out of the loop.
        } catch (error) {
          if (attempt === maxRetries) {
            console.error(
              `\nExtraction failed after ${maxRetries} attempts. File might be permanently locked or corrupted.`,
            );
            throw error;
          }
          console.log(
            `\nFile locked by Windows (likely Antivirus). Retrying in 1 second... (Attempt ${attempt} of ${maxRetries})`,
          );
          await new Promise((resolve) => setTimeout(resolve, retryDelay));
        }
      }

      // 2. The Cleanup Phase (Only runs if extraction worked)
      if (extractionSuccess) {
        try {
          // Move everything out of the "Release" folder
          const possibleReleaseDir = path.join(whisperDir, "Release");

          if (fs.existsSync(possibleReleaseDir)) {
            const files = fs.readdirSync(possibleReleaseDir);

            for (const file of files) {
              fs.renameSync(
                path.join(possibleReleaseDir, file),
                path.join(whisperDir, file),
              );
            }
            // Delete the now-empty Release folder
            fs.rmdirSync(possibleReleaseDir);
          }

          // Rename extracted main.exe to match our wrapper expectations
          const extractedMain = path.join(whisperDir, "main.exe");
          if (fs.existsSync(extractedMain)) {
            fs.renameSync(extractedMain, binaryDest);
          } else {
            console.error("Warning: Could not find main.exe after extraction.");
          }

          // Clean up the zip file
          if (fs.existsSync(zipPath)) {
            fs.unlinkSync(zipPath);
          }

          console.log(`Whisper binary setup complete for Windows (${arch}).`);
        } catch (error) {
          console.error("Error during binary cleanup/renaming:", error.message);
        }
      }
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
