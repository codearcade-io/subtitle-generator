import { spawn } from "child_process";
import os from "os";
import path from "path";

const __dirname = process.cwd();

const isWindows = os.platform() === "win32";
const isMac = os.platform() === "darwin";

const binaryName = isWindows
  ? "whisper-cli.exe"
  : isMac
    ? "whisper" // macOS whisper.cpp Metal build
    : "whisper"; // Linux or others

const audioLang = {
  English: "en",
  Spanish: "es",
  French: "fr",
  German: "de",
  Chinese: "zh",
  Japanese: "ja",
  Korean: "ko",
  Russian: "ru",
  Portuguese: "pt",
  Italian: "it",
  Dutch: "nl",
  Arabic: "ar",
  Hindi: "hi",
  Turkish: "tr",
} as const;

type AudioLangKey = keyof typeof audioLang;
type AudioLangValue = (typeof audioLang)[AudioLangKey];

interface WhisperOptions {
  modelPath: string; // Path to ggml model
  threads?: number; // CPU threads
  outputFormat?: "srt" | "txt" | "vtt"; // Output format
  audioLang?: AudioLangKey;
  srtLang?: AudioLangKey; // Optional SRT language code (e.g., "en", "es", "fr")
}

export class Whisper {
  private modelPath: string;
  private threads: number;
  private outputFormat: string;
  private audioLang?: AudioLangValue;
  private srtLang?: AudioLangValue;

  constructor(options: WhisperOptions) {
    this.modelPath = options.modelPath;
    this.threads = options.threads || 8;
    this.outputFormat = options.outputFormat || "srt";

    this.audioLang = options.audioLang
      ? audioLang[options.audioLang]
      : undefined;
    this.srtLang = options.srtLang ? audioLang[options.srtLang] : undefined;
  }

  /**
   * Transcribe a single audio file
   * @param inputFile - path to input audio
   * @param outputFile - path to output (without extension)
   */
  transcribe(inputFile: string, outputFile: string): Promise<void> {
    return new Promise((resolve, reject) => {
      const outputFlag =
        this.outputFormat === "srt"
          ? "-osrt"
          : this.outputFormat === "txt"
            ? "-otxt"
            : this.outputFormat === "vtt"
              ? "-ovtt"
              : "-osrt";

      const args = [
        "-m",
        this.modelPath,
        "-f",
        inputFile,
        outputFlag,
        "-of",
        outputFile,
        "-t",
        String(this.threads),

        "-bs",
        "5",
        "-bo",
        "1",

        "-ml",
        "30",
        "-sow",
        "false",
        "-nt",

        "-et",
        "2.4",
        "-lpt",
        "-1.0",
      ];

      if (this.audioLang) {
        args.push("-l", this.audioLang);
      }

      if (this.srtLang === "en" && this.audioLang !== "en") {
        args.push("-tr");
      }

      const binaryPath = path.join(__dirname, "whisper", binaryName);

      console.log("Running:", binaryPath, args.join(" "));

      const process = spawn(binaryPath, args);

      process.stdout.on("data", (data) => {
        console.log(`[stdout]: ${data}`);
      });

      process.stderr.on("data", (data) => {
        console.log(`[stderr]: ${data}`);
      });

      process.on("close", (code) => {
        if (code !== 0) {
          return reject(new Error(`Process exited with code ${code}`));
        }
        resolve();
      });

      process.on("error", (err) => {
        reject(err);
      });
    });
  }
}
