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

// Serve static files from the 'uploads' directory
service.use('/uploads', express.static(path.join(__dirname, 'uploads')));

const storage = multer.memoryStorage(); // Store files in memory
const upload = multer({ storage: storage });

const PORT = parseInt(process.env.SERVICE_PORT);
const { v4: uuidv4 } = require('uuid'); // Import UUID for unique filenames

service.post('/upload', upload.single('video'), async (req, res) => {
    try {
        if (!req.file || !req.file.buffer) {
            console.error('No file buffer found.');
            return res.status(400).send('No file buffer found.');
        }

        // Extract file information
        const { originalname, mimetype, buffer, size } = req.file;
        const { title = 'Undefined', description = '' } = req.body;

        // Create a temporary file for input and output
        const tempFile = tmp.fileSync({ postfix: path.extname(originalname) });
        const tempFilePath = tempFile.name;

        // Generate a unique output file name
        const uniqueSuffix = `${Date.now()}-${uuidv4()}`;
        const outputFileName = `processed-${uniqueSuffix}-${originalname}`;
        const outputPath = path.join(__dirname, 'uploads', outputFileName);

        // Write buffer to the temp file
        await fs.writeFile(tempFilePath, buffer);

        // Execute FFmpeg command
        const ffmpegCommand = `ffmpeg -i "${tempFilePath}" -vf "scale=640:360" "${outputPath}"`;

        exec(ffmpegCommand, async (err, stdout, stderr) => {
            if (err) {
                console.error('Error processing video with FFmpeg:', stderr);
                return res.status(500).send('Error processing video.');
            }

            const duration = '10'; // Placeholder duration

            try {
                // Save video details to MongoDB
                const video = new db_schema.video({
                    title: originalname,
                    description: description,
                    filePath: `/uploads/${outputFileName}`, // Use the unique file path
                    duration: duration,
                    format: mimetype,
                    size: size,
                    createdAt: new Date(),
                });

                await video.save();

                // Clean up temporary files
                tempFile.removeCallback();

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

// Serve static files from the 'uploads' directory
service.use('/uploads', express.static(path.join(__dirname, 'uploads')));

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

service.listen(PORT, () => {
    db.connectDB();
    console.log(`🚀 service ready at: http://localhost:${PORT}`);
});
