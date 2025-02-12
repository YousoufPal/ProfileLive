    // frontend/src/pages/upload.tsx
import { useState } from 'react';

export default function UploadPage() {
    const [selectedFile, setSelectedFile] = useState<File | null>(null);

    const handleFileChange = (event: React.ChangeEvent<HTMLInputElement>) => {
        if (event.target.files && event.target.files.length > 0) {
            setSelectedFile(event.target.files[0]);
        }
    };

    const handleUpload = () => {
        if (selectedFile) {
            console.log("File selected:", selectedFile.name);
        } else {
            console.log("No file selected.");
        }
    };

    return (
        <div>
            <h1>Upload Your Resume</h1>
            <input type="file" accept=".pdf" onChange={handleFileChange} />
            <button onClick={handleUpload} disabled={!selectedFile}>
                Upload
            </button>
            {selectedFile && <p>Selected file: {selectedFile.name}</p>}
        </div>
    );
}