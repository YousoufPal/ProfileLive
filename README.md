# Resume to Website Converter

This project allows users to upload their resume (in PDF format) and extract key information using AI. It then stores this data and can potentially be used to generate a personal website.  It also integrates with LinkedIn OAuth to fetch profile information.

## Features

- **Resume Upload:**  Upload PDF resumes through a frontend interface.
- **PDF Text Extraction:** Uses `pdf-parse` to extract text from uploaded PDFs.
- **AI-Powered Data Extraction:** Leverages OpenAI API (GPT models) to intelligently extract structured data like name, experience, education, and skills from resume text.
- **Data Storage:** Stores extracted data in MongoDB using Mongoose.
- **Frontend Display:** Displays the extracted resume data on the frontend for user review.
- **LinkedIn OAuth Integration:** Connect with LinkedIn to fetch profile data (basic, email, full profile).

## Prerequisites

- **Node.js and npm:**  Make sure you have Node.js and npm (Node Package Manager) installed on your system.
- **MongoDB:**  You need a running MongoDB instance. For local development, you can use MongoDB Community Server.
- **OpenAI API Key:**  You need an OpenAI API key to use the AI data extraction feature. Obtain one from the OpenAI website.
- **LinkedIn Developer Account and App:**  To use LinkedIn OAuth, you need a LinkedIn Developer account and to create an application to get Client ID and Client Secret.

## Setup Instructions

1. **Clone the repository:**
   ```bash
   git clone <your-repository-url>
   cd <your-project-directory>