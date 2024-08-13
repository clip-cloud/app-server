require('dotenv').config();

// const db = require('./mongodb/config.js');
// const db_schema = require('./mongodb/schema.js');

const db = require('./mongodb/config.js');
const db_schema = require('./mongodb/schema.js');

const express = require('express');
const bodyParser = require('body-parser');
const service = express();
service.use(bodyParser.json());

const PORT = parseInt(process.env.SERVICE_PORT);  

service.post('/insert/video', async (req, res) => {
    return new Promise((resolve, reject) => {
        db.insert(db_schema.video, req);
    });
});

service.listen(PORT, () => {
    db.connectDB();

    console.log(`🚀 service ready at: http://localhost:${PORT}`);

});
