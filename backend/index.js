const express = require('express');
const cors = require('cors');
require('dotenv').config();
const multer = require('multer');
const fs = require('fs'); 
const { OpenAI } = require('openai');

const app = express();
const port = 8000;

const upload = multer({ dest: 'uploads/' }); 

app.use(cors());
app.use(express.json());

const openai = new OpenAI({
    apiKey: process.env.OPENAI_API_KEY, 
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

    if (!fs.existsSync(filePath)) { 
        return res.status(500).send('Uploaded file not found on server.');
        }

        if (!dataBuffer) { 
            return res.status(500).send('Failed to read uploaded file.');
        }
    
    try {
        const data = await pdf(dataBuffer);
        console.log('Extracted PDF Text:', data.text);
        const aiResponse = await extractResumeDataWithAI(data.text);
+       console.log('AI Response:', aiResponse);
        res.json({ message: 'PDF parsed, text logged to console.' });
    } catch (error) {
    console.error('Error parsing PDF:', error);
    res.status(500).send('Error parsing PDF.');
    }
});

async function extractResumeDataWithAI(text) {
    const prompt = `
    Extract the following details from the resume text below:
        - Name
        - Experience (job title, company, dates)
        - Education (degree, institution, dates)
        - Skills (comma-separated list)

        Return the data in JSON format.
    
        Resume Text:
        ${text}
        `;
    
        try {
        const response = await openai.chat.completions.create({
            model: 'gpt-4',
            messages: [{ role: 'user', content: prompt }],
            temperature: 0.5,
            max_tokens: 500,
        });
            return response.choices[0].message.content; 
        } catch (error) {
            console.error('OpenAI API error:', error);
            return { error: 'Failed to extract data from resume using AI.' };
        }
    }


app.listen(port, () => {
    console.log(`Server running on http://localhost:${port}`);
});