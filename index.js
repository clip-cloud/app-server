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
const { v4: uuidv4 } = require('uuid');

const service = express();
service.use(cors());
service.use(bodyParser.json());

// Use environment variables
const PORT = process.env.PORT || 3000;
const MONGODB_URI = process.env.MONGODB_URL;

// Define base directory for uploads
const BASE_DIR = process.env.BASE_DIR || '/home/ec2-user/app';
const UPLOADS_DIR = path.join(BASE_DIR, 'uploads');
const TEMP_DIR = path.join(BASE_DIR, 'temp');

// Ensure directories exist
fs.mkdir(UPLOADS_DIR, { recursive: true }).catch(console.error);
fs.mkdir(TEMP_DIR, { recursive: true }).catch(console.error);

// Serve static files from the 'uploads' directory
service.use('/uploads', express.static(UPLOADS_DIR, {
    maxAge: '1d',
}));

const storage = multer.memoryStorage();
const upload = multer({ storage: storage });
service.get('/', (req, res) => {
    res.send('Welcome to the video processing server!');
  });

service.post('/upload', upload.single('video'), async (req, res) => {
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
        await fs.unlink(filePath);

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
    console.log(`🚀 service ready at: http://34.255.196.211:${PORT}`);
});

// Handle uncaught exceptions
process.on('uncaughtException', (error) => {
    console.error('Uncaught Exception:', error);
    // Perform any necessary cleanup here
    process.exit(1);
});

// Handle unhandled promise rejections
process.on('unhandledRejection', (reason, promise) => {
    console.error('Unhandled Rejection at:', promise, 'reason:', reason);
    // Perform any necessary cleanup here
});