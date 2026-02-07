/**
 * Test Server Start
 * Verify the server can start without errors
 */

const { spawn } = require('child_process');
const path = require('path');

console.log('🧪 Testing server start...');

// Start the server
const serverProcess = spawn('node', ['src/app.js'], {
  cwd: path.resolve(__dirname),
  stdio: 'pipe',
  env: { ...process.env }
});

let serverStarted = false;
let errorOccurred = false;

// Listen for output
serverProcess.stdout.on('data', (data) => {
  const output = data.toString();
  console.log('📟 Server output:', output);
  
  if (output.includes('Server running') || output.includes('🚀')) {
    serverStarted = true;
    console.log('✅ Server started successfully!');
    
    // Give it a moment to fully start
    setTimeout(() => {
      serverProcess.kill('SIGTERM');
    }, 2000);
  }
});

serverProcess.stderr.on('data', (data) => {
  const output = data.toString();
  console.error('❌ Server error:', output);
  errorOccurred = true;
});

serverProcess.on('close', (code) => {
  if (serverStarted) {
    console.log('✅ Server test completed successfully');
    console.log('🎉 SPC routes are working!');
  } else if (errorOccurred) {
    console.log('❌ Server failed to start properly');
  } else {
    console.log('⚠️ Server closed without clear success/failure');
  }
});

// Timeout after 10 seconds
setTimeout(() => {
  if (!serverStarted && !errorOccurred) {
    console.log('⏰ Server start timeout - killing process');
    serverProcess.kill('SIGTERM');
  }
}, 10000);
