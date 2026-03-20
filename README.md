# Subtitle Generator

Generate subtitle files (SRT, VTT, TXT) from audio files using OpenAI's Whisper model. Automatically downloads the binary and model files for your operating system.

## Features

- 🎬 Supports multiple subtitle formats (SRT, VTT, TXT)
- 🤖 Uses OpenAI's Whisper for accurate transcription
- 🔧 Multiple model sizes (small, medium, large)
- 🖥️ Cross-platform support (Windows, macOS, Linux)
- ⚡ Configurable thread count for performance tuning
- 🌍 Multi-language support with auto-detection

## Installation

```bash
npm install @codearcade/subtitle-generator
```

## Quick Start

### 1. Initialize the Package

Run the initialization command to download the Whisper binary and model:

```bash
npx subtitle-generator init
```

The init command will:

- Detect your operating system
- Download the appropriate Whisper binary
- Prompt you to choose a model size:
  - **small** - Fast transcription with good accuracy
  - **medium** - Balanced performance and accuracy
  - **large** - Highest accuracy (requires more resources)

### 2. Use in Your Code

Create a Node.js script to transcribe audio files:

```javascript
import path from "path";
import { Whisper } from "@codearcade/subtitle-generator";

const whisper = new Whisper({
  modelPath: path.join(process.cwd(), "models", "ggml-small.bin"),
  threads: 8,
  outputFormat: "srt", // "srt" | "txt" | "vtt"
  srtLang: "English",
  // audioLang: "English" // leave undefined for auto-detection
});

const inputFile = path.join(process.cwd(), "input", "audio.mp3");
const outputFile = path.join(process.cwd(), "output", "audio.srt");

async function main() {
  await whisper.transcribe(inputFile, outputFile);
  console.log("Transcription finished!");
}

main();
```

## API Reference

### Whisper Constructor

Create a new Whisper instance with configuration options:

```javascript
const whisper = new Whisper(options);
```

#### Options

| Option         | Type   | Default   | Description                                                                      |
| -------------- | ------ | --------- | -------------------------------------------------------------------------------- |
| `modelPath`    | string | required  | Absolute path to the Whisper model binary file                                   |
| `threads`      | number | 4         | Number of threads to use for transcription                                       |
| `outputFormat` | string | "srt"     | Output subtitle format: `"srt"`, `"vtt"`, or `"txt"`                             |
| `srtLang`      | string | "English" | Language for SRT metadata                                                        |
| `audioLang`    | string | undefined | Audio language code (e.g., "en", "es", "fr"). Leave undefined for auto-detection |

### Methods

#### `transcribe(inputPath, outputPath)`

Transcribe an audio file and save the output to a subtitle file.

**Parameters:**

- `inputPath` (string): Path to the audio file (supports mp3, wav, m4a, flac, etc.)
- `outputPath` (string): Path where the subtitle file will be saved

**Returns:** Promise<void>

**Example:**

```javascript
await whisper.transcribe("./audio/interview.mp3", "./subtitles/interview.srt");
```

## Supported Audio Formats

- MP3
- WAV
- M4A
- FLAC
- OGG
- WEBM
- And other common audio formats

## Supported Output Formats

### SRT (SubRip)

Standard subtitle format with timecodes and subtitle index:

```
1
00:00:00,000 --> 00:00:05,000
First subtitle line

2
00:00:05,000 --> 00:00:10,000
Second subtitle line
```

### VTT (WebVTT)

Web video text track format:

```
WEBVTT

00:00:00.000 --> 00:00:05.000
First subtitle line

00:00:05.000 --> 00:00:10.000
Second subtitle line
```

### TXT (Plain Text)

Simple text transcription with timestamps:

```
[00:00:00] First subtitle line
[00:00:05] Second subtitle line
```

## Configuration

### Model Selection

Models are stored in a `models` directory. After running `init`, choose your model size:

- **small** (~140MB) - Good for fast transcription with reasonable accuracy
- **medium** (~380MB) - Better accuracy with moderate performance impact
- **large** (~1.4GB) - Highest accuracy, requires more RAM and processing time

### Thread Count

Adjust the `threads` option based on your CPU:

```javascript
const whisper = new Whisper({
  modelPath: "./models/ggml-small.bin",
  threads: 16, // Use more threads on high-core-count CPUs
  outputFormat: "srt",
});
```

## Examples

### Batch Processing Multiple Files

```javascript
import path from "path";
import { Whisper } from "@codearcade/subtitle-generator";
import fs from "fs";

const whisper = new Whisper({
  modelPath: path.join(process.cwd(), "models", "ggml-small.bin"),
  threads: 8,
  outputFormat: "srt",
});

async function processAudioFiles() {
  const inputDir = "./input";
  const outputDir = "./output";

  const files = fs.readdirSync(inputDir);

  for (const file of files) {
    if (!file.endsWith(".mp3")) continue;

    const inputPath = path.join(inputDir, file);
    const outputPath = path.join(outputDir, file.replace(".mp3", ".srt"));

    console.log(`Processing ${file}...`);
    await whisper.transcribe(inputPath, outputPath);
    console.log(`Completed: ${file}`);
  }
}

processAudioFiles();
```

### Auto-Detect Language

```javascript
const whisper = new Whisper({
  modelPath: "./models/ggml-small.bin",
  threads: 8,
  outputFormat: "srt",
  // audioLang is undefined - language will be auto-detected
});

await whisper.transcribe("./audio/unknown-language.mp3", "./output/result.srt");
```

### Specify Language

```javascript
const whisper = new Whisper({
  modelPath: "./models/ggml-small.bin",
  threads: 8,
  outputFormat: "srt",
  audioLang: "es", // Spanish
});

await whisper.transcribe("./audio/spanish.mp3", "./output/spanish.srt");
```

## Project Structure

After using the package, your project structure might look like:

```
project/
├── models/
│   └── ggml-small.bin        # Downloaded Whisper model
├── input/
│   ├── audio1.mp3
│   └── audio2.mp3
├── output/
│   ├── audio1.srt
│   └── audio2.srt
├── transcribe.js             # Your transcription script
└── package.json
```

## Troubleshooting

### "Model file not found"

Make sure you ran `npx subtitle-generator init` first to download the model.

### "Binary not found for your OS"

The package only supports Windows, macOS, and Linux. Check that you're on a supported operating system.

### Slow transcription

- Increase the `threads` option (if your CPU has more cores)
- Use a smaller model (small instead of large)
- Ensure your system has adequate RAM available

### Out of memory errors

- Use a smaller model size
- Reduce the `threads` count
- Process files one at a time instead of in parallel

## Performance Tips

1. **Model Size**: Start with `small` model for speed, upgrade to `medium` or `large` if accuracy isn't sufficient
2. **Thread Count**: Set to number of CPU cores for optimal performance
3. **Batch Processing**: Process multiple files sequentially to avoid memory issues
4. **Audio Quality**: Clear audio produces better results than noisy recordings

## License

MIT © [CodeArcade](https://github.com/codearcade-io)

## Support

For issues, questions, or contributions, visit the [GitHub repository](https://github.com/codearcade-io/subtitle-generator).
