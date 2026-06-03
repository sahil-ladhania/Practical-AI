require('dotenv').config();
const readline = require('readline');
const { runAgent } = require('./agent/core');

const rl = readline.createInterface({
  input:  process.stdin,
  output: process.stdout
});

function ask(question) {
  return new Promise(resolve => rl.question(question, resolve));
}

async function main() {
  console.clear();
  console.log('┌─────────────────────────────────┐');
  console.log('│       CLI Agent — Plain JS       │');
  console.log('│  read_file  write_file           │');
  console.log('│  list_directory  run_shell        │');
  console.log('└─────────────────────────────────┘');
  console.log(`\nWorking directory: ${process.cwd()}`);
  console.log("Type 'exit' to quit\n");

  while (true) {
    const input = await ask('\nYou › ');

    if (!input.trim()) continue;
    if (input.trim().toLowerCase() === 'exit') {
      console.log('\nGoodbye.');
      rl.close();
      break;
    }

    try {
      const result = await runAgent(input.trim(), { maxIterations: 12 });
      console.log(`\nAgent › ${result}\n`);
    } catch (err) {
      console.error(`\n[Error] ${err.message}\n`);
    }
  }
}

main();