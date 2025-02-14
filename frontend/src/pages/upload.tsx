    // frontend/src/pages/upload.tsx
import { useState } from 'react';
import axios from 'axios';


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

interface ResumeData {
    name: string;
    experience: Experience[];
    education: Education[];
    skills: string[];
}


export default function UploadPage() {
    const [resumeData, setResumeData] = useState<ResumeData | null>(null);

    const handleFileUpload = async (event: React.ChangeEvent<HTMLInputElement>) => {
        if (event.target.files && event.target.files.length > 0) {
            setSelectedFile(event.target.files[0]);
        }
    };

    const handleUpload = () => {
        if (selectedFile) {
            setLoading(true);
            setError('');

            const formData = new FormData();
            formData.append('resume', selectedFile);

            axios.post('http://localhost:8000/upload', formData, {
                headers: { 'Content-Type': 'multipart/form-data' },
            })
            .then(response => {
                setResumeData(response.data.data); // Assuming backend sends data.data
                setLoading(false);
            })
            .catch(err => {
                setError('Failed to upload and process resume.');
                console.error(err);
                setLoading(false);
            
            });

            } else {
            console.log("No file selected.");
        }
    };

    return (
        <div>
+            <h1>Upload Resume</h1>
+            <input type="file" accept=".pdf" onChange={handleFileUpload} />
             <button onClick={handleUpload} disabled={!selectedFile}>
                Upload
            </button>
            {selectedFile && <p>Selected file: {selectedFile.name}</p>}
        </div>
    );
}

{resumeData && (
    <div>
        <h2>Extracted Data:</h2>
        {resumeData.name && <p>Name: {resumeData.name}</p>}
        {resumeData.experience && resumeData.experience.length > 0 && (
        <div>
            <h3>Experience:</h3>
            <ul>
                {resumeData.experience.map((exp, index) => (
                    <li key={index}>
                        {exp.jobTitle} at {exp.company} ({exp.dates})
                    </li>
                ))}
            </ul>
        </div>
    )}
    
    {resumeData.education && resumeData.education.length > 0 && (
        <div>
                    
            <h3>Education:</h3>
            <ul>
                {resumeData.education.map((edu, index) => (
                        <li key={index}>
                        {edu.degree} at {edu.institution} ({edu.dates})
                    </li>
                ))}
                </ul>
            </div>
        )}
    {resumeData.skills && resumeData.skills.length > 0 && <p>Skills: {resumeData.skills.join(', ')}</p>}
</div>
)}


{loading && <p>Loading...</p>}
{error && <p style={{ color: 'red' }}>Error: {error}</p>}