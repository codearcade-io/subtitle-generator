#!/usr/bin/env node

const args = process.argv.slice(2);

if (args[0] === 'init') {
  import('../init/index.js').then(mod => mod.default());
} else {
  console.log('Usage: npx @codearcade/ai-subtitle-generator init');
}