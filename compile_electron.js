const { app } = require('electron');
app.whenReady().then(async () => {
    const bytenode = require('./server/node_modules/bytenode');
    bytenode.compileFile({
        filename: './server/licencia.js',
        output: './server/licencia.jsc'
    });
    console.log('Compilado correctamente');
    app.quit();
});