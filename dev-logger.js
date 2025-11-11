const fs = require('fs');
const path = require('path');
const { spawn } = require('child_process');

// Create dev.log file path
const logPath = path.join(__dirname, 'dev.log');

// Start nodemon
const nodemon = spawn('nodemon', [
  '--exec', 'npx tsx server.ts',
  '--watch', 'server.ts',
  '--watch', 'src',
  '--ext', 'ts,tsx,js,jsx'
], {
  stdio: ['inherit', 'pipe', 'pipe'],
  shell: true
});

// Clear existing log file
fs.writeFileSync(logPath, '');

// Function to get timestamp
function getTimestamp() {
  return new Date().toISOString();
}

// Capture output and write to both console and file
nodemon.stdout.on('data', (data) => {
  const output = data.toString();
  process.stdout.write(output);
  fs.appendFileSync(logPath, `[${getTimestamp()}] ${output}`);
});

nodemon.stderr.on('data', (data) => {
  const output = data.toString();
  process.stderr.write(output);
  fs.appendFileSync(logPath, `[${getTimestamp()}] [ERROR] ${output}`);
});

nodemon.on('close', (code) => {
  console.log(`Process exited with code ${code}`);
  fs.appendFileSync(logPath, `[${getTimestamp()}] Process exited with code ${code}\n`);
});

// Handle process termination
process.on('SIGINT', () => {
  console.log('\nReceived SIGINT, shutting down gracefully...');
  fs.appendFileSync(logPath, `[${getTimestamp()}] Received SIGINT, shutting down...\n`);
  nodemon.kill('SIGINT');
  process.exit(0);
});

process.on('SIGTERM', () => {
  console.log('\nReceived SIGTERM, shutting down gracefully...');
  fs.appendFileSync(logPath, `[${getTimestamp()}] Received SIGTERM, shutting down...\n`);
  nodemon.kill('SIGTERM');
  process.exit(0);
});

console.log('Starting development server...');
console.log('Logs are being written to: dev.log');
fs.appendFileSync(logPath, `[${getTimestamp()}] Starting development server...\n`);