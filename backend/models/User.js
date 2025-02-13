const mongoose = require('mongoose');

const experienceSchema = new mongoose.Schema({
    jobTitle: String,
    company: String,
    dates: String
});

const educationSchema = new mongoose.Schema({
    degree: String,
    institution: String,
    dates: String
});

const userSchema = new mongoose.Schema({
    name: String,
    experience: [experienceSchema],
    education: [educationSchema],
    skills: [String],
    createdAt: { type: Date, default: Date.now }
});

module.exports = mongoose.model('User', userSchema);