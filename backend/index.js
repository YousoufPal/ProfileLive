const express = require('express');
const multer = require('multer');
const pdf = require('pdf-parse');
const cors = require('cors');
const fs = require('fs');
const app = express();
const port = 8000;
const mongoose = require('mongoose');
const User = require('./models/User');
require('dotenv').config();
const axios = require('axios');
const querystring = require('querystring');
const { OpenAI } = require('openai');

const openai = new OpenAI({
    apiKey: process.env.OPENAI_API_KEY,
});

app.use(cors());
app.use(express.json());

const upload = multer({ dest: 'uploads/' });

const mongoURI = 'mongodb://localhost:27017/resume-to-website';

mongoose.connect(mongoURI, { useNewUrlParser: true, useUnifiedTopology: true })
    .then(() => console.log('MongoDB connected successfully'))
    .catch(err => console.error('MongoDB connection error:', err));

app.post('/upload', upload.single('resume'), async (req, res) => {
    try {
        if (!req.file) {
            throw new Error('File not uploaded');
        }

        const filePath = req.file.path;
        const dataBuffer = fs.readFileSync(filePath);
    
        const data = await pdf(dataBuffer);
        console.log('Extracted PDF Text:', data.text);
    
        const aiResponse = await extractResumeDataWithAI(data.text);
        console.log('AI Extracted Data:', aiResponse);
    
        const extractedData = {
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
    
        const newUser = new User(extractedData);
        await newUser.save();
    
        fs.unlinkSync(filePath);
    
        res.status(200).json({ success: true, data: extractedData });
    } catch (error) {
        console.error('Error processing upload:', error);
        res.status(500).json({ success: false, message: error.message });
    }
});

app.get('/user/:id', async (req, res) => {
    try {
        const user = await User.findById(req.params.id);
        if (!user) {
            return res.status(404).json({ success: false, message: 'User not found' });
        }
        res.status(200).json({ success: true, data: user });
    } catch (error) {
        res.status(500).json({ success: false, message: error.message });
    }
});

const linkedinAuthUrl = 'https://www.linkedin.com/oauth/v2/authorization';
const linkedinTokenUrl = 'https://www.linkedin.com/oauth/v2/accessToken';

app.get('/auth/linkedin', (req, res) => {
    const params = querystring.stringify({
        response_type: 'code',
        client_id: process.env.LINKEDIN_CLIENT_ID,
        redirect_uri: 'http://localhost:8000/auth/linkedin/callback',
        scope: 'openid profile email r_liteprofile r_fullprofile r_emailaddress w_member_social',
        state: 'abc123'
    });

    res.redirect(`${linkedinAuthUrl}?${params}`);
});

app.get('/auth/linkedin/callback', async (req, res) => {
    const code = req.query.code;
    console.log('LinkedIn callback query parameters:', req.query);
    
    if (!code) {
        console.error('Missing "code" parameter in callback:', req.query);
        return res.status(400).json({ error: 'Missing code parameter in callback.' });
    }

    try {
        const formData = querystring.stringify({
            grant_type: 'authorization_code',
            code: code,
            redirect_uri: 'http://localhost:8000/auth/linkedin/callback',
            client_id: process.env.LINKEDIN_CLIENT_ID,
            client_secret: process.env.LINKEDIN_CLIENT_SECRET
        });

        const tokenResponse = await axios.post(linkedinTokenUrl, formData, {
            headers: {
                'Content-Type': 'application/x-www-form-urlencoded'
            }
        });

        const { access_token } = tokenResponse.data;

        const basicProfileResponse = await axios.get('https://api.linkedin.com/v2/me', {
            headers: {
                'Authorization': `Bearer ${access_token}`
            }
        });

        const emailResponse = await axios.get('https://api.linkedin.com/v2/emailAddress?q=members&projection=(elements*(handle~))', {
            headers: {
                'Authorization': `Bearer ${access_token}`
            }
        });

        const fullProfileResponse = await axios.get('https://api.linkedin.com/v2/me?projection=(id,firstName,lastName,profilePicture,headline,summary,positions,education,skills)', {
            headers: {
                'Authorization': `Bearer ${access_token}`
            }
        });

        const positionsResponse = await axios.get('https://api.linkedin.com/v2/positions?q=member&projection=(elements*(id,title,company,startDate,endDate,current,description))', {
            headers: {
                'Authorization': `Bearer ${access_token}`
            }
        });

        const profileData = {
            ...basicProfileResponse.data,
            email: emailResponse.data.elements?.[0]?.['handle~']?.emailAddress,
            fullProfile: fullProfileResponse.data,
            positions: positionsResponse.data
        };

        res.json(profileData);
    } catch (error) {
        console.error('Error details:', {
            message: error.message,
            response: error.response?.data,
            status: error.response?.status,
            endpoint: error.config?.url
        });
        res.status(500).json({ 
            success: false, 
            message: error.message,
            details: error.response?.data 
        });
    }
});

app.listen(port, () => {
    console.log(`Server running on http://localhost:${port}`);
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

    const response = await openai.chat.completions.create({
        model: 'gpt-4',
        messages: [{ role: 'user', content: prompt }],
        temperature: 0.5,
        max_tokens: 500,
    });

    const extractedData = JSON.parse(response.choices[0].message.content);
    return extractedData;
}