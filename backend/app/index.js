const serveStatic = require('serve-static');
const express = require('express');
const http = require('http');
const path = require('path');

const staticDir = path.resolve(path.join(__dirname, '..', '..', 'frontend', 'dist'));

const app = express();

app.use(serveStatic(staticDir));

http.createServer(app).listen(8080, () => {
    console.log("started listening :8080");
});
