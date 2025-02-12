const express = require('express');
const cors = require('cors');
require('dotenv').config();
const multer = require('multer');
const fs = require('fs'); // Add fs module
const { OpenAI } = require('openai'); // Import OpenAI


const app = express();
const port = 8000;

const upload = multer({ dest: 'uploads/' }); 

app.use(cors());
app.use(express.json());

const openai = new OpenAI({
    apiKey: process.env.OPENAI_API_KEY, // Make sure you have OPENAI_API_KEY in .env
});

app.get('/', (req, res) => {
    res.send('Backend server is running!');
});

app.post('/upload', upload.single('resume'), async (req, res) => {
    res.json({ message: 'Upload endpoint hit, but no file processing yet.' });
    if (!req.file) {
        return res.status(400).send('No file uploaded.');
    }
    
    const filePath = req.file.path;
    const dataBuffer = fs.readFileSync(filePath);

    if (!fs.existsSync(filePath)) { // Check if file exists
        return res.status(500).send('Uploaded file not found on server.');
        }

        if (!dataBuffer) { // Check if dataBuffer is read correctly
            return res.status(500).send('Failed to read uploaded file.');
        }
    
    try {
        const data = await pdf(dataBuffer);
        console.log('Extracted PDF Text:', data.text);
        res.json({ message: 'PDF parsed, text logged to console.' });
    } catch (error) {
    console.error('Error parsing PDF:', error);
    res.status(500).send('Error parsing PDF.');
    }
});


app.listen(port, () => {
    console.log(`Server running on http://localhost:${port}`);
});