import { getToken } from '../utils/auth';

const API_BASE_URL = 'http://localhost:5000/api/assessments';


export const getAllTemplates = async () => {
    const token = getToken();
    const response = await fetch(`${API_BASE_URL}/templates`, {
        headers: {
            'Authorization': `Bearer ${token}`,
            'Content-Type': 'application/json'
        }
    });

    if (!response.ok) {
        const error = await response.json();
        throw new Error(error.message || 'Failed to fetch templates');
    }

    return response.json();
};

export const getTemplate = async (templateId) => {
    const token = getToken();
    const response = await fetch(`${API_BASE_URL}/templates/${templateId}`, {
        headers: {
            'Authorization': `Bearer ${token}`,
            'Content-Type': 'application/json'
        }
    });

    if (!response.ok) {
        const error = await response.json();
        throw new Error(error.message || 'Failed to fetch template');
    }

    return response.json();
};

export const createTemplate = async (templateData) => {
    const token = getToken();
    const response = await fetch(`${API_BASE_URL}/templates`, {
        method: 'POST',
        headers: {
            'Authorization': `Bearer ${token}`,
            'Content-Type': 'application/json'
        },
        body: JSON.stringify(templateData)
    });

    if (!response.ok) {
        const error = await response.json();
        throw new Error(error.message || 'Failed to create template');
    }

    return response.json();
};

export const updateTemplate = async (templateId, templateData) => {
    const token = getToken();
    const response = await fetch(`${API_BASE_URL}/templates/${templateId}`, {
        method: 'PUT',
        headers: {
            'Authorization': `Bearer ${token}`,
            'Content-Type': 'application/json'
        },
        body: JSON.stringify(templateData)
    });

    if (!response.ok) {
        const error = await response.json();
        throw new Error(error.message || 'Failed to update template');
    }

    return response.json();
};

export const deleteTemplate = async (templateId) => {
    const token = getToken();
    const response = await fetch(`${API_BASE_URL}/templates/${templateId}`, {
        method: 'DELETE',
        headers: {
            'Authorization': `Bearer ${token}`,
            'Content-Type': 'application/json'
        }
    });

    if (!response.ok) {
        const error = await response.json();
        throw new Error(error.message || 'Failed to delete template');
    }

    return response.json();
};

export const addQuestions = async (templateId, questions) => {
    const token = getToken();
    const response = await fetch(`${API_BASE_URL}/templates/${templateId}/questions`, {
        method: 'POST',
        headers: {
            'Authorization': `Bearer ${token}`,
            'Content-Type': 'application/json'
        },
        body: JSON.stringify({ questions })
    });

    if (!response.ok) {
        const error = await response.json();
        throw new Error(error.message || 'Failed to add questions');
    }

    return response.json();
};

export const updateQuestion = async (questionId, questionData) => {
    const token = getToken();
    const response = await fetch(`${API_BASE_URL}/questions/${questionId}`, {
        method: 'PUT',
        headers: {
            'Authorization': `Bearer ${token}`,
            'Content-Type': 'application/json'
        },
        body: JSON.stringify(questionData)
    });

    if (!response.ok) {
        const error = await response.json();
        throw new Error(error.message || 'Failed to update question');
    }

    return response.json();
};

export const deleteQuestion = async (questionId) => {
    const token = getToken();
    const response = await fetch(`${API_BASE_URL}/questions/${questionId}`, {
        method: 'DELETE',
        headers: {
            'Authorization': `Bearer ${token}`,
            'Content-Type': 'application/json'
        }
    });

    if (!response.ok) {
        const error = await response.json();
        throw new Error(error.message || 'Failed to delete question');
    }

    return response.json();
};

export const linkAssessmentToJob = async (jobId, templateId, isRequired = true, deadlineHours = 48) => {
    const token = getToken();
    const response = await fetch(`${API_BASE_URL}/jobs/${jobId}/link`, {
        method: 'POST',
        headers: {
            'Authorization': `Bearer ${token}`,
            'Content-Type': 'application/json'
        },
        body: JSON.stringify({
            template_id: templateId,
            is_required: isRequired,
            deadline_hours: deadlineHours
        })
    });

    if (!response.ok) {
        const error = await response.json();
        throw new Error(error.message || 'Failed to link assessment');
    }

    return response.json();
};

export const getJobAssessments = async (jobId) => {
    const token = getToken();
    const response = await fetch(`${API_BASE_URL}/jobs/${jobId}`, {
        headers: {
            'Authorization': `Bearer ${token}`,
            'Content-Type': 'application/json'
        }
    });

    if (!response.ok) {
        const error = await response.json();
        throw new Error(error.message || 'Failed to fetch job assessments');
    }

    return response.json();
};

export const unlinkAssessmentFromJob = async (jobId, templateId) => {
    const token = getToken();
    const response = await fetch(`${API_BASE_URL}/jobs/${jobId}/link/${templateId}`, {
        method: 'DELETE',
        headers: {
            'Authorization': `Bearer ${token}`,
            'Content-Type': 'application/json'
        }
    });

    if (!response.ok) {
        const error = await response.json();
        throw new Error(error.message || 'Failed to unlink assessment');
    }

    return response.json();
};

export const getApplicationAssessmentResults = async (applicationId) => {
    const token = getToken();
    const response = await fetch(`${API_BASE_URL}/applications/${applicationId}/results`, {
        headers: {
            'Authorization': `Bearer ${token}`,
            'Content-Type': 'application/json'
        }
    });

    if (!response.ok) {
        const error = await response.json();
        throw new Error(error.message || 'Failed to fetch results');
    }

    return response.json();
};


export const getMyCandidateAssessments = async () => {
    const token = getToken();
    const response = await fetch(`${API_BASE_URL}/me`, {
        headers: {
            'Authorization': `Bearer ${token}`,
            'Content-Type': 'application/json'
        }
    });

    if (!response.ok) {
        const error = await response.json();
        throw new Error(error.message || 'Failed to fetch assessments');
    }

    return response.json();
};

export const startAssessment = async (assessmentId) => {
    const token = getToken();
    const response = await fetch(`${API_BASE_URL}/${assessmentId}/start`, {
        headers: {
            'Authorization': `Bearer ${token}`,
            'Content-Type': 'application/json'
        }
    });

    if (!response.ok) {
        const error = await response.json();
        throw new Error(error.message || 'Failed to start assessment');
    }

    return response.json();
};

export const submitAssessment = async (assessmentId, answers) => {
    const token = getToken();
    const response = await fetch(`${API_BASE_URL}/${assessmentId}/submit`, {
        method: 'POST',
        headers: {
            'Authorization': `Bearer ${token}`,
            'Content-Type': 'application/json'
        },
        body: JSON.stringify({ answers })
    });

    if (!response.ok) {
        const error = await response.json();
        throw new Error(error.message || 'Failed to submit assessment');
    }

    return response.json();
};

export const getMyAssessmentResult = async (assessmentId) => {
    const token = getToken();
    const response = await fetch(`${API_BASE_URL}/${assessmentId}/result`, {
        headers: {
            'Authorization': `Bearer ${token}`,
            'Content-Type': 'application/json'
        }
    });

    if (!response.ok) {
        const error = await response.json();
        throw new Error(error.message || 'Failed to fetch result');
    }

    return response.json();
};



export const getAssessmentForGrading = async (assessmentId) => {
    const token = getToken();
    const response = await fetch(`${API_BASE_URL}/${assessmentId}/grading`, {
        headers: {
            'Authorization': `Bearer ${token}`,
            'Content-Type': 'application/json'
        }
    });

    if (!response.ok) {
        const error = await response.json();
        throw new Error(error.message || 'Failed to fetch assessment for grading');
    }

    return response.json();
};

export const gradeAssessment = async (assessmentId, grades) => {
    const token = getToken();
    const response = await fetch(`${API_BASE_URL}/${assessmentId}/grade`, {
        method: 'POST',
        headers: {
            'Authorization': `Bearer ${token}`,
            'Content-Type': 'application/json'
        },
        body: JSON.stringify({ grades })
    });

    if (!response.ok) {
        const error = await response.json();
        throw new Error(error.message || 'Failed to grade assessment');
    }

    return response.json();
};
