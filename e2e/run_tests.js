const { execSync, spawn } = require('child_process');
const fs = require('fs');
const path = require('path');

const backendDir = path.join(__dirname, '..', 'backend');
const dbPath = path.join(backendDir, 'shaavir.db');

// 1. Wipe DB
if (fs.existsSync(dbPath)) {
  fs.unlinkSync(dbPath);
  console.log('Wiped database.');
}

// 2. Start server
console.log('Starting backend server...');
const server = spawn('npm', ['run', 'dev'], { cwd: backendDir, shell: true });
let serverReady = false;

server.stdout.on('data', (data) => {
  const output = data.toString();
  if (output.includes('Server listening')) {
    serverReady = true;
    console.log('Server is ready.');
    // 3. Run playwright
    try {
      execSync('npx playwright test tests/setup_wizard.spec.js', { stdio: 'inherit', cwd: __dirname });
    } catch (e) {
      console.error('Playwright tests failed.');
      process.exitCode = 1;
    } finally {
      server.kill();
      process.exit();
    }
  }
});

server.stderr.on('data', (data) => {
  console.error(data.toString());
});
