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
const puppeteer = require('puppeteer');


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
        scope: 'openid profile email',  // Back to the working OpenID Connect scopes
        state: 'abc123'
    });

    res.redirect(`${linkedinAuthUrl}?${params}`);
});

app.get('/auth/linkedin/callback', async (req, res) => {
    if (req.query.error) {
        console.error('LinkedIn OAuth error:', req.query);
        return res.status(400).json({ 
            success: false, 
            error: req.query.error,
            description: req.query.error_description 
        });
    }

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

        // Get user info using the OpenID Connect userinfo endpoint
        const userInfoResponse = await axios.get('https://api.linkedin.com/v2/userinfo', {
            headers: {
                'Authorization': `Bearer ${access_token}`
            }
        });

        res.json(userInfoResponse.data);
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

app.post('/linkedin-scrape', async (req, res) => {
    try {
      const { profileUrl } = req.body;
      if (!profileUrl || !profileUrl.includes("linkedin.com/in/")) {
        return res.status(400).json({ error: "Invalid LinkedIn URL" });
      }
  
      const browser = await puppeteer.launch({ headless: false });
      const page = await browser.newPage();
  
      // Set viewport and user agent to mimic a real browser
      await page.setViewport({ width: 1280, height: 800 });
      await page.setUserAgent(
        "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/115.0.0.0 Safari/537.36"
      );
  
      // Load session cookies from file and set them in the page
      const cookiesString = fs.readFileSync('linkedin-cookies.json', 'utf8');
      const cookies = JSON.parse(cookiesString);
      await page.setCookie(...cookies);
  
      // Navigate to the profile page with authentication
      await page.goto(profileUrl, { waitUntil: 'load', timeout: 60000 });
  
      // Wait for a key element to ensure the profile page is loaded
      await page.waitForSelector('h1', { timeout: 10000 });
  
      const scrapedData = await page.evaluate(() => {
        // Name: Using the first <h1> element
        const nameEl = document.querySelector('h1');
        const name = nameEl ? nameEl.innerText.trim() : "";
      
        // Headline: Try selecting the element with a class commonly used for the headline in the left panel
        let headline = "";
        const headlineEl = document.querySelector('.pv-text-details__left-panel .text-body-medium');
        if (headlineEl) {
          headline = headlineEl.innerText.trim();
        }
      
        // Location: Try to grab the location text using known classes
        let location = "";
        const locationEl = document.querySelector('.pv-text-details__left-panel ul li.t-14.t-black--light') ||
                            document.querySelector('.pv-text-details__left-panel .t-14.t-black--light');
        if (locationEl) {
          location = locationEl.innerText.trim();
        }
      
        // Experience: Attempt to collect experience items from the experience section
        let experience = [];
        // LinkedIn sometimes uses a section with an ID or class for experience; try both.
        const expSection = document.querySelector('#experience-section') || document.querySelector('.experience-section');
        if (expSection) {
          // Assuming each experience item is within an <li> element
          const expItems = expSection.querySelectorAll('li');
          experience = Array.from(expItems)
            .map(li => li.innerText.trim())
            .filter(text => text.length > 0);
        }
      
        // Education: Similarly, extract education items
        let education = [];
        const eduSection = document.querySelector('#education-section') || document.querySelector('.education-section');
        if (eduSection) {
          const eduItems = eduSection.querySelectorAll('li');
          education = Array.from(eduItems)
            .map(li => li.innerText.trim())
            .filter(text => text.length > 0);
        }
      
        // Skills: Extract skills from the skills section (ensure the section is expanded if needed)
        let skills = [];
        const skillsSection = document.querySelector('section.pv-skill-categories-section');
        if (skillsSection) {
          const skillEls = skillsSection.querySelectorAll('.pv-skill-category-entity__name-text');
          skills = Array.from(skillEls)
            .map(el => el.innerText.trim())
            .filter(text => text.length > 0);
        }
      
        return { name, headline, location, experience, education, skills };
      });
        
      await browser.close();
      res.json(scrapedData);
    } catch (error) {
      console.error('Error scraping LinkedIn profile:', error);
      res.status(500).json({ error: error.message });
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

    const response = await openai.chat.completions.create({
        model: 'gpt-4',
        messages: [{ role: 'user', content: prompt }],
        temperature: 0.5,
        max_tokens: 500,
    });

    const extractedData = JSON.parse(response.choices[0].message.content);
    return extractedData;
}

app.listen(port, () => {
    console.log(`Server running on http://localhost:${port}`);
});