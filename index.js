"use strict";

import express from 'express';
import bodyParser from 'body-parser';
import uploadRouter from "./routes/upload.js";
import fileupload from 'express-fileupload';
import cors from "cors";
const app = express();
app.use(cors());
const PORT = 10010;

app.use(express.json());
app.use(express.urlencoded({
    extended: true
}));

app.use(fileupload());
app.use(function (req, res, next) {
    res.setHeader('Access-Control-Allow-Origin', '*');
    res.setHeader('Access-Control-Allow-Methods', 'GET, POST, OPTIONS, PUT, PATCH, DELETE');
    res.setHeader('Access-Control-Allow-Headers', 'X-Requested-With,content-type');
    res.setHeader('Access-Control-Allow-Credentials', true);
    next();
});

app.use("/annotate", uploadRouter)

app.listen(PORT, function () {
    // logger.trace("asset server started on port number " + port);
    console.log(`App started on port: ${PORT} , To start api use: https://localhost:${PORT}`);
});