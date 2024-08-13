// const db = require('./mongodb/config.js');
// const db_schema = require('./mongodb/schema.js');

require('dotenv').config();

const db = require('./mongodb/config.js');
const db_schema = require('./mongodb/schema.js');

const express = require('express');
const bodyParser = require('body-parser');
const service = express();
service.use(bodyParser.json());

const PORT = parseInt(process.env.SERVICE_PORT);  // Default to 3000 if SERVICE_PORT is not set


service.post('/insert/video', async (req, res) => {
    return new Promise((resolve, reject) => {
        // Insert the model data into the 'models' table within the specified schema
        db.insert(db_schema.video, req);
    });
});

service.listen(PORT, () => {
    db.connectDB();

    console.log(`🚀 service ready at: http://localhost:${PORT}`);

});
