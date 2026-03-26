// Test with app lifecycle
const electron = require('electron');
const app = electron.app;
console.log('type:', typeof electron);
console.log('app type:', typeof app);

if (app) {
  app.on('ready', () => {
    console.log('protocol:', typeof electron.protocol);
    app.quit();
  });
} else {
  console.log('no app, exiting');
  process.exit(1);
}
