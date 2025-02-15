// src/types/api.ts
export interface Experience {
    jobTitle: string;
    company: string;
    dates: string;
}

export interface Education {
    degree: string;
    institution: string;
    dates: string;
}

export interface ResumeData {
    name: string;
    experience: Experience[];
    education: Education[];
    skills: string[];
}

export interface ApiResponse {
    success: boolean;
    data: ResumeData;
}