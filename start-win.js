const fs = require('fs');
const path = require('path');
const { spawn } = require('child_process');

// Set production environment
process.env.NODE_ENV = 'production';

// Create server.log file path
const logPath = path.join(__dirname, 'server.log');

// Start the production server
const server = spawn('tsx', ['server.ts'], {
  stdio: ['inherit', 'pipe', 'pipe'],
  shell: true,
  env: { ...process.env, NODE_ENV: 'production' }
});

// Clear existing log file
fs.writeFileSync(logPath, '');

// Function to get timestamp
function getTimestamp() {
  return new Date().toISOString();
}

// Capture output and write to both console and file
server.stdout.on('data', (data) => {
  const output = data.toString();
  process.stdout.write(output);
  fs.appendFileSync(logPath, `[${getTimestamp()}] ${output}`);
});

server.stderr.on('data', (data) => {
  const output = data.toString();
  process.stderr.write(output);
  fs.appendFileSync(logPath, `[${getTimestamp()}] [ERROR] ${output}`);
});

server.on('close', (code) => {
  console.log(`Production server exited with code ${code}`);
  fs.appendFileSync(logPath, `[${getTimestamp()}] Production server exited with code ${code}\n`);
});

// Handle process termination
process.on('SIGINT', () => {
  console.log('\nReceived SIGINT, shutting down production server gracefully...');
  fs.appendFileSync(logPath, `[${getTimestamp()}] Received SIGINT, shutting down...\n`);
  server.kill('SIGINT');
  process.exit(0);
});

process.on('SIGTERM', () => {
  console.log('\nReceived SIGTERM, shutting down production server gracefully...');
  fs.appendFileSync(logPath, `[${getTimestamp()}] Received SIGTERM, shutting down...\n`);
  server.kill('SIGTERM');
  process.exit(0);
});

console.log('🚀 Starting production server...');
console.log('📝 Logs are being written to: server.log');
console.log('🌐 Environment: production');
fs.appendFileSync(logPath, `[${getTimestamp()}] Starting production server...\n`);
fs.appendFileSync(logPath, `[${getTimestamp()}] Environment: production\n`);