import path from "path";
import { Whisper } from "../src/index";

const whisper = new Whisper({
  modelPath: path.join(process.cwd(), "models", "ggml-small.bin"),
  threads: 8,
  outputFormat: "srt", // "srt" | "txt" | "vtt"
  srtLang: "English",
  // audioLang:"English"// leave it undefined for auto
});

async function main() {
  await whisper.transcribe(
    path.join(process.cwd(), "input", "day-1.mp3"),
    path.join(process.cwd(), "output", "some.srt"),
  );
  console.log("Transcription finished!");
}

main();
