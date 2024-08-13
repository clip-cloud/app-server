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
    try {
        // Extract video data from the request body
        const { title, description, videoUrl } = req.body;

        // Ensure the data exists and is valid
        if (!title || !videoUrl) {
            return res.status(400).json({ error: 'Title and videoUrl are required' });
        }

        // Create a new video document
        const newVideo = new db_schema.VideoModel({
            title,
            description,
            videoUrl,
            createdAt: new Date(),
        });

        // Save the document to the database
        const savedVideo = await newVideo.save();

        // Respond with the saved video data
        res.status(201).json(savedVideo);
    } catch (error) {
        console.error('Error saving video:', error);
        res.status(500).send('Failed to save video');
    }
});

service.listen(PORT, () => {
    db.connectDB();

    console.log(`🚀 service ready at: http://localhost:${PORT}`);

});
