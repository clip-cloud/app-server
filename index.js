require('dotenv').config();
const cors = require('cors');


// const db = require('./mongodb/config.js');
// const db_schema = require('./mongodb/schema.js');

const db = require('./mongodb/config.js');
const db_schema = require('./mongodb/schema.js');

const express = require('express');
const bodyParser = require('body-parser');
const service = express();

service.use(cors());
service.use(bodyParser.json());

const multer = require('multer');
const { exec } = require('child_process');
const path = require('path');

const upload = multer({ dest: 'uploads/' });

const PORT = parseInt(process.env.SERVICE_PORT);

const fs = require('fs');
const tmp = require('tmp');

service.post('/upload', upload.single('video'), (req, res) => {


    const tmpFile = tmp.fileSync({ postfix: '.mp4' });

    console.log("This is tmp file name", tmpFile.name);
    exec(`ffmpeg -i ${req.file.path} -ss 00:00:05 -t 00:00:10 -c copy ${tmpFile.name}`, (err) => {
        if (err) {
            console.error('Error processing video:', err);
            return res.status(500).send('Error processing video');
        }



        // Read the temp file and upload to MongoDB
        fs.createReadStream(tmpFile.name)
            .pipe(bucket.openUploadStream(path.basename(tmpFile.name)))
            .on('error', (error) => {
                console.error('Error uploading to MongoDB:', error);
                return res.status(500).send('Error uploading video to MongoDB');
            })
            .on('finish', () => {
                console.log('Video uploaded successfully to MongoDB');
                tmpFile.removeCallback(); // Cleanup temporary file
                res.send({ message: 'Video processed and uploaded to MongoDB successfully' });
            });
        console.log("End!");

    });
});



service.post('/request/videos', async (req, res) => {
    try {
        const videos = await db_schema.video.find(); // Fetch all videos from MongoDB
        res.json(videos); // Send the videos back to the client
    } catch (error) {
        console.error('Error fetching videos:', error);
        res.status(500).json({ message: 'Internal Server Error' });
    }
});


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
