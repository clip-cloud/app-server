require('dotenv').config();
const cors = require('cors');
const express = require('express');
const bodyParser = require('body-parser');
const path = require('path');
const fs = require('fs').promises; // Use promises API for fs
const multer = require('multer');
const { exec } = require('child_process');
const db = require('./mongodb/config.js');
const db_schema = require('./mongodb/schema.js');
const { v4: uuidv4 } = require('uuid'); // Import UUID for unique filenames

const service = express();
service.use(cors());
service.use(bodyParser.json());

// Serve static files from the 'uploads' directory
service.use('/uploads', express.static(path.join(__dirname, 'uploads'), {
    maxAge: '1d', // Cache static files for 1 day
}));

const storage = multer.memoryStorage(); // Store files in memory
const upload = multer({ storage: storage });

const PORT = parseInt(process.env.SERVICE_PORT);

service.post('/upload', upload.single('video'), async (req, res) => {
    try {
        if (!req.file || !req.file.buffer) {
            console.error('No file buffer found.');
            return res.status(400).send('No file buffer found.');
        }

        const { originalname, mimetype, buffer, size } = req.file;
        const { startTime, endTime, title = 'Undefined', description = '' } = req.body;

        const tempDir = path.join(__dirname, 'temp');
        await fs.mkdir(tempDir, { recursive: true });
        const tempFilePath = path.join(tempDir, path.basename(originalname));

        // Ensure the output directory exists
        const outputDir = path.join(__dirname, 'uploads');
        await fs.mkdir(outputDir, { recursive: true });

        const uniqueSuffix = `${Date.now()}-${uuidv4()}`;
        const outputFileName = `${uniqueSuffix}-${originalname}`;
        const outputPath = path.join(__dirname, 'uploads', outputFileName);

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
                await fs.rmdir(tempDir, { recursive: true }); // Clean up temp directory
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
        // Find the video entry in the database
        const video = await db_schema.video.findById(videoId);

        if (!video) {
            throw new Error('Video not found');
        }

        // Delete the video file from the filesystem
        const filePath = path.join(__dirname, 'uploads', path.basename(video.filePath));
        await fs.unlink(filePath);

        // Delete the video entry from the database
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
        const videos = await db_schema.video.find(); // Fetch all videos from MongoDB

        if (videos.length === 0) {
            return res.status(404).json({ message: 'No videos found' });
        }

        res.status(200).json(videos); // Send the videos back to the client with a success status
    } catch (error) {
        console.error('Error fetching videos:', error);
        res.status(500).json({ message: 'Internal Server Error' }); // Handle any errors that occur during fetching
    }
});

service.get('/request/single/video/:id', async (req, res) => {
    const videoId = req.params.id;
    try {
        // Fetch the video from your database using the videoId
        const video = await db_schema.video.findById(videoId);

        if (!video) {
            return res.status(404).send('Video not found');
        }

        // Send the video data back to the client
        res.status(200).json(video);
    } catch (error) {
        console.error("Error fetching video: ", error);
        res.status(500).send('Error fetching video');
    }
});

service.listen(PORT, () => {
    db.connectDB();
    console.log(`🚀 service ready at: http://localhost:${PORT}`);
});
