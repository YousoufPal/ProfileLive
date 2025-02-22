const express = require('express');
const multer = require('multer');
const pdf = require('pdf-parse');
const cors = require('cors');
const fs = require('fs').promises;
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

// Express route handler
app.post('/linkedin-scrape', async (req, res) => {
    try {
        const { profileUrl } = req.body;
        
        if (!profileUrl) {
            return res.status(400).json({ error: 'Profile URL is required' });
        }

        const profileData = await scrapeLinkedInProfile(profileUrl);
        res.json(profileData);

    } catch (error) {
        console.error('Error in LinkedIn scrape route:', error);
        res.status(500).json({ 
            error: error.message,
            details: 'Make sure the profile URL is valid'
        });
    }
});

// URL validation helper
function validateAndFormatLinkedInUrl(url) {
    try {
      // Check if URL is provided
      if (!url) {
        throw new Error('URL is required');
      }
  
      // Convert to string if not already
      url = url.toString();
  
      // Add https:// if not present
      if (!url.startsWith('http://') && !url.startsWith('https://')) {
        url = 'https://' + url;
      }
  
      // Create URL object to validate format
      const urlObject = new URL(url);
  
      // Verify it's a LinkedIn profile URL
      if (!urlObject.hostname.includes('linkedin.com')) {
        throw new Error('Not a LinkedIn URL');
      }
  
      // Verify it's a profile URL
      if (!urlObject.pathname.includes('/in/')) {
        throw new Error('Not a LinkedIn profile URL');
      }
  
      // Return the properly formatted URL
      return urlObject.href;
    } catch (error) {
      throw new Error(`Invalid LinkedIn URL: ${error.message}`);
    }
  }
  
  async function scrapeLinkedInProfile(profileUrl) {
    let browser = null;
    try {
      const validUrl = validateAndFormatLinkedInUrl(profileUrl);
      
      browser = await puppeteer.launch({
        headless: false, // set to true for production
        args: [
          '--no-sandbox',
          '--disable-setuid-sandbox',
          '--disable-dev-shm-usage',
          '--disable-gpu'
        ]
      });
      const page = await browser.newPage();
      await page.setViewport({ width: 1920, height: 1080 });
      await page.setUserAgent(
        'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/121.0.0.0 Safari/537.36'
      );
  
      // Navigate to LinkedIn homepage to set the domain context
      await page.goto('https://www.linkedin.com/', { waitUntil: 'load', timeout: 60000 });
  
      // Load cookies from file and set them on the page
      const cookiesPath = 'c:/Users/pyous/Downloads/ProfileLive/backend/linkedin-cookies.json';
      const cookiesString = await fs.readFile(cookiesPath, 'utf8');
      const cookies = JSON.parse(cookiesString);
      console.log("Loaded cookies:", cookies);
      await page.setCookie(...cookies);
  
      // Now navigate to the validated profile URL
      console.log('Navigating to profile:', validUrl);
      await page.goto(validUrl, { waitUntil: 'load', timeout: 60000 });
      await page.waitForSelector('h1', { timeout: 15000 });
      
      // Get the raw HTML content of the profile page
      const htmlContent = await page.content();
  
      // Build a prompt to ask ChatGPT to extract and summarize the profile data as plain text
      const prompt = `
  Here is the raw HTML of a LinkedIn profile page (truncated to 15000 characters):
  ${htmlContent.substring(0, 15000)}
  
  Please extract and summarize all the relevant information from this profile, such as:
  - Name
  - Headline
  - Location
  - Experience
  - Education
  - Skills
  
  Return the summary as plain text.
      `;
  
      // Call OpenAI's API to process the HTML and return a summary as plain text
      const openaiResponse = await openai.chat.completions.create({
        model: 'gpt-4',
        messages: [{ role: 'user', content: prompt }],
        temperature: 0.5,
        max_tokens: 1000,
      });
  
      // Return the text output directly, without trying to parse JSON
      const processedText = openaiResponse.choices[0].message.content;
      return { text: processedText };
  
    } catch (error) {
      console.error('LinkedIn scraping error:', error);
      throw error;
    } finally {
      if (browser) {
        await browser.close();
      }
    }
  }
  

app.listen(port, () => {
    console.log(`Server running on http://localhost:${port}`);
});