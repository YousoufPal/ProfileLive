const express = require('express');
const cors = require('cors');
require('dotenv').config();
const multer = require('multer');
const fs = require('fs'); 
const { OpenAI } = require('openai');
const mongoose = require('mongoose');
const User = require('./models/User');

const app = express();
const port = 8000;

const upload = multer({ dest: 'uploads/' }); 

app.use(cors());
app.use(express.json());

const openai = new OpenAI({
    apiKey: process.env.OPENAI_API_KEY, 
});

const mongoURI = 'mongodb://localhost:27017/profilelive'; 

mongoose.connect(mongoURI, { useNewUrlParser: true, useUnifiedTopology: true })
    .then(() => console.log('MongoDB connected successfully'))
    .catch(err => console.error('MongoDB connection error:', err));


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

        let aiResponse;
        let extractedData;

        try {
            const rawAIResponse = await extractResumeDataWithAI(data.text);
            aiResponse = JSON.parse(rawAIResponse); 

            extractedData = {
                name: aiResponse.Name,
                experience: aiResponse.Experience.map(exp => ({
                    jobTitle: exp['Job Title'],
                    company: exp.Company,
                    dates: exp.Dates
                })),
                education: aiResponse.Education.map(edu => ({
                    degree: edu.Degree || edu.Program,
                    institution: edu.Institution,
                    dates: edu.Dates
                })),
                skills: aiResponse.Skills.split(',').map(skill => skill.trim())
            };
            console.log('Transformed AI Data:', extractedData);


            const newUser = new User(extractedData);
            await newUser.save();

            console.log('AI Extracted Data:', aiResponse);
            res.json({ success: true, data: aiResponse }); 
            } catch (parseError) {
                console.error('JSON Parse Error:', parseError);
                console.log('Raw AI Response (parse failed):', rawAIResponse);  
                return res.status(500).json({ success: false, message: 'Failed to parse AI response.', rawResponse: rawAIResponse });
            }

        // const aiResponse = await extractResumeDataWithAI(data.text);
        // console.log('AI Response:', aiResponse);

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
        const content = response.choices[0].message.content;
        if (!content) {
            console.warn('OpenAI API returned empty content.');
            return '{}'; 
        }
        return content;

    } catch (error) {
        console.error('OpenAI API error:', error);
        return { error: 'Failed to extract data from resume using AI.' };
    }
}


app.listen(port, () => {
    console.log(`Server running on http://localhost:${port}`);
});