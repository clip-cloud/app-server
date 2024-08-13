const mongo = require('./config.js');

const video = mongo.mongoose.model('gallery', {
    title: {
        type: String,
        required: true,
        trim: true
    },
    description: {
        type: String,
        trim: true
    },
    filePath: {
        type: String,
        required: true
    },
    duration: {
        type: Number, // Duration in seconds
        required: true
    },
    format: {
        type: String,
        required: true
    },
    width: {
        type: Number
    },
    height: {
        type: Number
    },
    size: {
        type: Number // Size in bytes
    },
    createdAt: {
        type: Date,
        default: Date.now
    }
});

const gallery = mongo.mongoose.model('video', {
    name: {
        type: String,
        required: true
    },
    description: {
        type: String
    },
    videos: [{
        type: mongo.mongoose.Schema.Types.ObjectId,
        ref: 'Video'
    }]
});

module.exports = { gallery, video };