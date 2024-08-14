require('dotenv').config();
const cors = require('cors');
const express = require('express');
const bodyParser = require('body-parser');
const path = require('path');
const fs = require('fs').promises; // Use promises API for fs
const multer = require('multer');
const tmp = require('tmp');
const { exec } = require('child_process');
const db = require('./mongodb/config.js');
const db_schema = require('./mongodb/schema.js');

const service = express();
service.use(cors());
service.use(bodyParser.json());

const storage = multer.memoryStorage(); // Store files in memory
const upload = multer({ storage: storage });

const PORT = parseInt(process.env.SERVICE_PORT);

service.post('/upload', upload.single('video'), async (req, res) => {
    try {
        if (!req.file || !req.file.buffer) {
            console.error('No file buffer found.');
            return res.status(400).send('No file buffer found.');
        }

        // Extract file information
        const { originalname, mimetype, buffer, size } = req.file;
        const { title = 'Undifined', description = '' } = req.body;

        // Create a temporary file for input and output
        const tempFile = tmp.fileSync({ postfix: path.extname(req.file.originalname) });
        const tempFilePath = tempFile.name;
        const outputPath = path.join(__dirname, 'uploads', 'processed-' + req.file.originalname);

        // Write buffer to the temp file
        await fs.writeFile(tempFilePath, buffer);

        // Execute FFmpeg command
        const ffmpegCommand = `ffmpeg -i "${tempFilePath}" -vf "scale=640:360" "${outputPath}"`;
        console.log(`Executing FFmpeg command: ${ffmpegCommand}`);

        exec(ffmpegCommand, async (err, stdout, stderr) => {
            if (err) {
                console.error('Error processing video with FFmpeg:', stderr);
                return res.status(500).send('Error processing video.');
            }

            console.log('req.body.title:', req);

            try {
                // Save video details to MongoDB
                const video = new db_schema.video({
                    title: originalname,
                    description: description,
                    filePath: outputPath, // Path to the processed video
                    duration: '0', // You may want to extract this from FFmpeg output
                    format: mimetype,
                    size: size,
                    createdAt: new Date()
                });

                await video.save();

                // Clean up temporary files
                tempFile.removeCallback();
                await fs.unlink(outputPath);

                res.status(200).send('Video uploaded and processed successfully.');
            } catch (err) {
                console.error('Error saving video:', err);
                res.status(500).send('Error saving video.');
            }
        });
    } catch (err) {
        console.error('Error processing request:', err);
        res.status(500).send('Error processing request.');
    }
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
        const newVideo = new db_schema.video({
            title,
            description,
            filePath: videoUrl,
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
