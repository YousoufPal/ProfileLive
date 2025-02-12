const express = require('express');
const cors = require('cors');
require('dotenv').config();
const multer = require('multer');

const app = express();
const port = 8000;

const upload = multer({ dest: 'uploads/' }); 

app.use(cors());
app.use(express.json());

app.get('/', (req, res) => {
    res.send('Backend server is running!');
});

app.post('/upload', (req, res) => {
    res.json({ message: 'Upload endpoint hit, but no file processing yet.' });
});

app.listen(port, () => {
    console.log(`Server running on http://localhost:${port}`);
});