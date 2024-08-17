const mongo = require('./config.js');

const video = mongo.mongoose.model('video', {
    title: {
        type: String,
        required: true
    },
    description: {
        type: String,
        default: ''
    },
    filePath: {
        type: String,
        required: true
    },
    duration: {
        type: String,
        default: '0'
    },
    format: {
        type: String,
        default: ''
    },
    size: {
        type: Number,
        default: 0
    },
    createdAt: {
        type: Date,
        default: Date.now
    }
});

const gallery = mongo.mongoose.model('gallery', {
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