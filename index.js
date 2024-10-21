const { v4: uuidv4 } = require('uuid');
require('dotenv').config();

const cors = require('cors');
const express = require('express');

const bodyParser = require('body-parser');
const path = require('path');

const fs = require('fs').promises;

const multer = require('multer');
const { exec } = require('child_process');
const db = require('./mongodb/config.js');
const db_schema = require('./mongodb/schema.js');

const service = express();
service.use(cors());
service.use(bodyParser.json());


// Use environment variables
const PORT = process.env.PORT;
const MONGODB_URI = process.env.MONGODB_URL;

const { MongoClient } = require("mongodb");

const username = encodeURIComponent("p@ssw0rd'9'!");
const password = encodeURIComponent("p@ssw0rd'9'!");
// console.log("this is the encode URL: ", password)

// Defines directory for uploads
const BASE_DIR = process.env.BASE_DIR;
const UPLOADS_DIR = path.join(BASE_DIR, 'uploads');
const TEMP_DIR = path.join(BASE_DIR, 'temp');

console.log('BASE_DIR:', process.env.BASE_DIR);  // or whichever variable is undefined


// Chek if the directories exists
fs.mkdir(UPLOADS_DIR, { recursive: true }).catch(console.error);
fs.mkdir(TEMP_DIR, { recursive: true }).catch(console.error);

// Serve static files from the 'uploads' directory
service.use('/uploads', express.static(UPLOADS_DIR, {
    maxAge: '1d',
}));


// keeps the uploaded files in memory as a Buffer object, working as a small cahche
const storage = multer.memoryStorage();
// uploaded files will be stored in memory temporarily during the request like a cache
const upload = multer({ storage: storage });


// This event is never triggired from the client side
service.get('/', (req, res) => {
    res.send('Welcome to the video processing server!');
});

service.post('/upload', upload.single('video'), async (req, res) => {
    console.log("test11");
    try {
        if (!req.file || !req.file.buffer) {
            console.error('No file buffer found.');
            return res.status(400).send('No file buffer found.');
        }

        const { originalname, mimetype, buffer, size } = req.file;
        const { startTime, endTime, title = 'Undefined', description = '' } = req.body;

        const tempFilePath = path.join(TEMP_DIR, path.basename(originalname));

        const uniqueSuffix = `${Date.now()}-${uuidv4()}`;
        const outputFileName = `${uniqueSuffix}-${originalname}`;
        const outputPath = path.join(UPLOADS_DIR, outputFileName);

        await fs.writeFile(tempFilePath, buffer);

        const ffmpegCommand = `ffmpeg -ss ${startTime} -i "${tempFilePath}" -to ${endTime} -c copy "${outputPath}"`;

        exec(ffmpegCommand, async (err, stdout, stderr) => {
            if (err) {
                console.error('Error processing video with FFmpeg:', stderr);
                return res.status(500).send('Error processing video.');
            }
            console.log('FFmpeg stdout:', stdout);
            console.log('FFmpeg stderr:', stderr);

            try {
                const video = new db_schema.video({
                    title: originalname,
                    description: description,
                    filePath: `/uploads/${outputFileName}`,
                    duration: endTime - startTime,
                    format: mimetype,
                    size: size,
                    createdAt: new Date(),
                });

                await video.save();
                await fs.unlink(tempFilePath);
                res.status(200).send({ message: 'Video uploaded and processed successfully.', filePath: `/uploads/${outputFileName}` });
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

service.delete('/request/video/:id', async (req, res) => {
    const videoId = req.params.id;
    try {
        const video = await db_schema.video.findById(videoId);

        if (!video) {
            return res.status(404).send('Video not found');
        }

        const filePath = path.join(UPLOADS_DIR, path.basename(video.filePath));

        try {
            // Check if the file exists before trying to delete
            await fs.access(filePath);
            await fs.unlink(filePath); // If the file exists, delete it
        } catch (fileErr) {
            console.error(`File not found or could not be accessed: ${filePath}`);
            return res.status(404).send('File not found or already deleted.');
        }

        // Delete the video document from the database
        await db_schema.video.findByIdAndDelete(videoId);
        res.status(200).send('Video removed');
    } catch (error) {
        console.error('Error deleting video:', error);
        res.status(500).send('Error removing video');
    }
});

service.get('/request/videos', async (req, res) => {
    try {
        console.log("Fetching videos from the database...");
        const videos = await db_schema.video.find();

        if (videos.length === 0) {
            return res.status(404).json({ message: 'No videos found' });
        }

        res.status(200).json(videos);
    } catch (error) {
        console.error('Error fetching videos:', error);
        res.status(500).json({ message: 'Internal Server Error' });
    }
});

service.get('/request/single/video/:id', async (req, res) => {
    const videoId = req.params.id;
    try {
        const video = await db_schema.video.findById(videoId);

        if (!video) {
            return res.status(404).send('Video not found');
        }

        res.status(200).json(video);
    } catch (error) {
        console.error("Error fetching video: ", error);
        res.status(500).send('Error fetching video');
    }
});

service.listen(PORT, '0.0.0.0', () => {
    db.connectDB(MONGODB_URI);
    console.log(`🚀 service ready at: http://localhost:${PORT}`);
});


// Handles any uncaught exceptions in the application
process.on('uncaughtException', (error) => {
    console.error('Uncaught Exception:', error);
    process.exit(1);
});
// Handles any unhandled promise rejections, this lines are not most, just for insure
process.on('unhandledRejection', (reason, promise) => {
    console.error('Unhandled Rejection at:', promise, 'reason:', reason);
});