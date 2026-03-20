import path from "path";
import { Whisper } from "../src/index";

const whisper = new Whisper({
  modelPath: path.join(__dirname, "models", "ggml-small.bin"),
  threads: 8,
  outputFormat: "srt", // "srt" | "txt" | "vtt"
  srtLang: "English",
  // audioLang:"English"// leave it undefined for auto
  
});

async function main() {
  await whisper.transcribe(
    path.join(__dirname, "input", "some.mp3"),
    path.join(__dirname, "output", "some.srt"),
  );
  console.log("Transcription finished!");
}

main();
