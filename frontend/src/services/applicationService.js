import { getToken } from '../utils/auth';

const API_URL = 'http://localhost:5000/api/applications';

export const getAllApplications = async () => {
    const token = getToken();

    const response = await fetch(API_URL, {
        method: 'GET',
        headers: {
            'Authorization': `Bearer ${token}`
        }
    });

    if (!response.ok) {
        const error = await response.json();
        throw new Error(error.message || 'Failed to fetch applications');
    }

    return response.json();
};

export const getJobApplications = async (jobId) => {
    const token = getToken();

    const response = await fetch(`${API_URL}/job/${jobId}`, {
        method: 'GET',
        headers: {
            'Authorization': `Bearer ${token}`
        }
    });

    if (!response.ok) {
        const error = await response.json();
        throw new Error(error.message || 'Failed to fetch job applications');
    }

    return response.json();
};

export const getApplicationDetail = async (applicationId) => {
    const token = getToken();

    const response = await fetch(`${API_URL}/${applicationId}/detail`, {
        method: 'GET',
        headers: {
            'Authorization': `Bearer ${token}`
        }
    });

    if (!response.ok) {
        const error = await response.json();
        throw new Error(error.message || 'Failed to fetch application detail');
    }

    return response.json();
};

export const shortlistApplication = async (applicationId) => {
    const token = getToken();

    const response = await fetch(`${API_URL}/${applicationId}/shortlist`, {
        method: 'POST',
        headers: {
            'Authorization': `Bearer ${token}`
        }
    });

    if (!response.ok) {
        const error = await response.json();
        throw new Error(error.message || 'Failed to shortlist application');
    }

    return response.json();
};

export const rejectApplication = async (applicationId, rejectionReason, rejectionNote) => {
    const token = getToken();

    const response = await fetch(`${API_URL}/${applicationId}/reject`, {
        method: 'POST',
        headers: {
            'Authorization': `Bearer ${token}`,
            'Content-Type': 'application/json'
        },
        body: JSON.stringify({
            rejection_reason: rejectionReason,
            rejection_note: rejectionNote || null
        })
    });

    if (!response.ok) {
        const error = await response.json();
        throw new Error(error.message || 'Failed to reject application');
    }

    return response.json();
};

export const submitApplication = async (jobId, cvFile, details = {}) => {
    const token = getToken();

    const formData = new FormData();
    formData.append('job_id', jobId);
    formData.append('phone', details.phone || '');
    if (details.cover_note) {
        formData.append('cover_note', details.cover_note);
    }
    if (details.expected_salary) {
        formData.append('expected_salary', details.expected_salary);
    }
    if (details.availability) {
        formData.append('availability', details.availability);
    }
    formData.append('cv', cvFile);

    const response = await fetch(API_URL, {
        method: 'POST',
        headers: {
            'Authorization': `Bearer ${token}`
        },
        body: formData
    });

    if (!response.ok) {
        let message = 'Failed to submit application';
        try {
            const body = await response.json();
            if (body && body.message) message = body.message;
        } catch {
            if (response.status === 500) {
                message = 'The file could not be uploaded. Use a PDF or DOCX under 5 MB.';
            }
        }
        const error = new Error(message);
        error.status = response.status;
        throw error;
    }

    return response.json();
};

export const updateApplicationStatus = async (applicationId, stage) => {
    const token = getToken();

    const response = await fetch(`${API_URL}/${applicationId}`, {
        method: 'PUT',
        headers: {
            'Authorization': `Bearer ${token}`,
            'Content-Type': 'application/json'
        },
        body: JSON.stringify({ stage })
    });

    if (!response.ok) {
        const error = await response.json();
        throw new Error(error.message || 'Failed to update application stage');
    }

    return response.json();
};

export const deleteApplication = async (applicationId) => {
    const token = getToken();

    const response = await fetch(`${API_URL}/${applicationId}`, {
        method: 'DELETE',
        headers: {
            'Authorization': `Bearer ${token}`
        }
    });

    if (!response.ok) {
        const error = await response.json();
        throw new Error(error.message || 'Failed to delete application');
    }

    return response.json();
};

export const downloadApplicationCV = async (applicationId, filename) => {
    const token = getToken();

    const response = await fetch(`${API_URL}/${applicationId}/cv`, {
        method: 'GET',
        headers: {
            'Authorization': `Bearer ${token}`
        }
    });

    if (!response.ok) {
        let message = 'Failed to download CV';
        try {
            const body = await response.json();
            if (body && body.message) message = body.message;
        } catch {
        }
        throw new Error(message);
    }

    let downloadName = filename;
    if (!downloadName) {
        downloadName = `cv_${applicationId}`;
        const contentDisposition = response.headers.get('Content-Disposition');
        if (contentDisposition) {
            const match = contentDisposition.match(/filename="?([^";\n]+)"?/);
            if (match && match[1]) {
                downloadName = match[1];
            }
        }
    }

    const blob = await response.blob();
    const url = window.URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = downloadName;
    document.body.appendChild(a);
    a.click();

    setTimeout(() => {
        window.URL.revokeObjectURL(url);
        document.body.removeChild(a);
    }, 100);
};

export const getMyApplicationDetail = async (applicationId) => {
    const token = getToken();

    const response = await fetch(`${API_URL}/me/applications/${applicationId}`, {
        method: 'GET',
        headers: {
            'Authorization': `Bearer ${token}`
        }
    });

    if (!response.ok) {
        let message = 'Failed to fetch application';
        try {
            const body = await response.json();
            if (body && body.message) message = body.message;
        } catch {
        }
        throw new Error(message);
    }

    return response.json();
};

export const getApplicationEvents = async (applicationId) => {
    const token = getToken();

    const response = await fetch(`${API_URL}/hr/${applicationId}/events`, {
        method: 'GET',
        headers: {
            'Authorization': `Bearer ${token}`
        }
    });

    if (!response.ok) {
        const error = await response.json().catch(() => ({}));
        throw new Error(error.message || 'Failed to fetch activity');
    }

    return response.json();
};

export const addApplicationNote = async (applicationId, note) => {
    const token = getToken();

    const response = await fetch(`${API_URL}/${applicationId}/notes`, {
        method: 'POST',
        headers: {
            'Authorization': `Bearer ${token}`,
            'Content-Type': 'application/json'
        },
        body: JSON.stringify({ note })
    });

    if (!response.ok) {
        const error = await response.json().catch(() => ({}));
        throw new Error(error.message || 'Failed to add note');
    }

    return response.json();
};

export const getApplicationDuplicates = async (applicationId) => {
    const token = getToken();

    const response = await fetch(`${API_URL}/${applicationId}/duplicates`, {
        method: 'GET',
        headers: {
            'Authorization': `Bearer ${token}`
        }
    });

    if (!response.ok) {
        const error = await response.json().catch(() => ({}));
        throw new Error(error.message || 'Failed to fetch duplicate check');
    }

    return response.json();
};