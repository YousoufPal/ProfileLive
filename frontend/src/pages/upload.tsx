import { useState } from 'react';
import axios from 'axios';
import { motion } from 'framer-motion';

interface Experience {
  jobTitle: string;
  company: string;
  dates: string;
}

interface Education {
  degree: string;
  institution: string;
  dates: string;
}

interface LocalResumeData {
  name: string;
  experience: Experience[];
  education: Education[];
  skills: string[];
}

export default function UploadPage() {
  const [resumeData, setResumeData] = useState<LocalResumeData | null>(null);
  // Instead of using "any", we use Record<string, unknown> to type the scraped data.
  const [linkedinData, setLinkedinData] = useState<Record<string, unknown> | null>(null);
  const [linkedinUrl, setLinkedinUrl] = useState<string>('');
  const [loading, setLoading] = useState<boolean>(false);
  const [error, setError] = useState<string>('');

  // Handler for resume file upload
  const handleFileUpload = async (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (!file) return;

    setLoading(true);
    setError('');

    const formData = new FormData();
    formData.append('resume', file);

    try {
      const response = await axios.post('http://localhost:8000/upload', formData, {
        headers: { 'Content-Type': 'multipart/form-data' },
      });

      const transformedData: LocalResumeData = {
        name: response.data.data.name,
        experience: response.data.data.experience.map((exp: Experience) => ({
          jobTitle: exp.jobTitle,
          company: exp.company,
          dates: exp.dates,
        })),
        education: response.data.data.education,
        skills: response.data.data.skills,
      };

      setResumeData(transformedData);
    } catch (err) {
      setError('Failed to upload and process resume.');
      console.error(err);
    } finally {
      setLoading(false);
    }
  };

  // Handler for LinkedIn scraping + OAuth
  const handleLinkedInClick = async () => {
    // Validate the LinkedIn URL
    if (!linkedinUrl.includes('linkedin.com/in/')) {
      setError('Invalid LinkedIn URL');
      return;
    }
    setError('');

    // Start scraping concurrently
    fetch('http://localhost:8000/linkedin-scrape', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ profileUrl: linkedinUrl }),
    })
      .then((response) => response.json())
      .then((data) => {
        setLinkedinData(data);
        console.log('Scraped LinkedIn Data:', data);
      })
      .catch((err) => {
        setError('Failed to scrape LinkedIn profile');
        console.error(err);
      });

    // Launch OAuth flow in a new tab concurrently
    window.open('http://localhost:8000/auth/linkedin', '_blank');
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-blue-50 to-purple-50 py-12 px-4 sm:px-6 lg:px-8">
      <div className="max-w-4xl mx-auto">
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.5 }}
          className="bg-white p-8 rounded-lg shadow-xl"
        >
          <h1 className="text-4xl font-bold text-gray-900 mb-6 text-center">
            Build Your Personal Website
          </h1>
          <p className="text-lg text-gray-600 mb-8 text-center">
            Upload your resume, and we&apos;ll transform it into a stunning personal website.
          </p>

          {/* LinkedIn URL Input and Button */}
          <div className="mb-8 flex flex-col sm:flex-row items-center gap-4 justify-center">
            <input
              type="text"
              placeholder="Paste LinkedIn Profile URL"
              className="border p-2 rounded w-full sm:w-1/2"
              value={linkedinUrl}
              onChange={(e) => setLinkedinUrl(e.target.value)}
            />
            <button
              onClick={handleLinkedInClick}
              className="bg-blue-600 text-white px-4 py-2 rounded-md"
            >
              Connect with LinkedIn
            </button>
          </div>

          {/* Resume Upload */}
          <div className="mb-8">
            <label className="block text-sm font-medium text-gray-700 mb-2">
              Upload Resume (PDF)
            </label>
            <div className="mt-1 flex justify-center px-6 pt-5 pb-6 border-2 border-dashed border-gray-300 rounded-lg">
              <div className="space-y-1 text-center">
                <svg
                  className="mx-auto h-12 w-12 text-gray-400"
                  stroke="currentColor"
                  fill="none"
                  viewBox="0 0 48 48"
                  aria-hidden="true"
                >
                  <path
                    d="M28 8H12a4 4 0 00-4 4v20m32-12v8m0 0v8a4 4 0 01-4 4H12a4 4 0 01-4-4v-4m32-4l-3.172-3.172a4 4 0 00-5.656 0L28 28M8 32l9.172-9.172a4 4 0 015.656 0L28 28m0 0l4 4m4-24h8m-4-4v8m-12 4h.02"
                    strokeWidth="2"
                    strokeLinecap="round"
                    strokeLinejoin="round"
                  />
                </svg>
                <div className="flex text-sm text-gray-600">
                  <label
                    htmlFor="resume-upload"
                    className="relative cursor-pointer bg-white rounded-md font-medium text-indigo-600 hover:text-indigo-500 focus-within:outline-none focus-within:ring-2 focus-within:ring-offset-2 focus-within:ring-indigo-500"
                  >
                    <span>Upload a file</span>
                    <input
                      id="resume-upload"
                      name="resume-upload"
                      type="file"
                      accept=".pdf"
                      onChange={handleFileUpload}
                      className="sr-only"
                    />
                  </label>
                  <p className="pl-1">or drag and drop</p>
                </div>
                <p className="text-xs text-gray-500">PDF up to 10MB</p>
              </div>
            </div>
          </div>

          {loading && (
            <div className="flex justify-center">
              <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-indigo-600"></div>
            </div>
          )}

          {error && <div className="text-red-500 text-center mb-4">{error}</div>}

          {resumeData && (
            <motion.div
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.5 }}
              className="mt-8"
            >
              <h2 className="text-2xl font-bold text-gray-900 mb-4">
                Extracted Resume Data
              </h2>
              <div className="space-y-4">
                <div>
                  <h3 className="text-xl font-medium">Name</h3>
                  <p className="text-gray-700">{resumeData.name || 'N/A'}</p>
                </div>
                <div>
                  <h3 className="text-xl font-medium">Experience</h3>
                  <ul className="list-disc list-inside text-gray-700">
                    {resumeData.experience?.length ? (
                      resumeData.experience.map((exp, index) => (
                        <li key={index}>
                          {exp.jobTitle} at {exp.company} ({exp.dates})
                        </li>
                      ))
                    ) : (
                      <li>No experience data available</li>
                    )}
                  </ul>
                </div>
                <div>
                  <h3 className="text-xl font-medium">Education</h3>
                  <ul className="list-disc list-inside text-gray-700">
                    {resumeData.education?.length ? (
                      resumeData.education.map((edu, index) => (
                        <li key={index}>
                          {edu.degree} at {edu.institution} ({edu.dates})
                        </li>
                      ))
                    ) : (
                      <li>No education data available</li>
                    )}
                  </ul>
                </div>
                <div>
                  <h3 className="text-xl font-medium">Skills</h3>
                  <p className="text-gray-700">
                    {resumeData.skills?.join(', ') || 'No skills data available'}
                  </p>
                </div>
              </div>
            </motion.div>
          )}

          {linkedinData && (
            <motion.div
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.5 }}
              className="mt-8 bg-gray-100 p-4 rounded"
            >
              <h2 className="text-2xl font-bold text-gray-900 mb-4">
                Scraped LinkedIn Data (JSON)
              </h2>
              <pre className="text-sm text-gray-800 whitespace-pre-wrap">
                {JSON.stringify(linkedinData, null, 2)}
              </pre>
            </motion.div>
          )}
        </motion.div>
      </div>
    </div>
  );
}
