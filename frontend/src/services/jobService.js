import { getToken } from '../utils/auth';

const API_URL = 'http://localhost:5000/api/jobs';

export const getAllJobs = async () => {
    const token = getToken();

    const response = await fetch(API_URL, {
        method: 'GET',
        headers: {
            'Authorization': `Bearer ${token}`,
            'Content-Type': 'application/json'
        }
    });

    if (!response.ok) {
        const error = await response.json();
        throw new Error(error.message || 'Failed to fetch jobs');
    }

    return response.json();
};

export const getJobById = async (id) => {
    const token = getToken();

    const response = await fetch(`${API_URL}/${id}`, {
        method: 'GET',
        headers: {
            'Authorization': `Bearer ${token}`,
            'Content-Type': 'application/json'
        }
    });

    if (!response.ok) {
        const error = await response.json();
        throw new Error(error.message || 'Failed to fetch job');
    }

    return response.json();
};

export const createJob = async (jobData) => {
    const token = getToken();

    const response = await fetch(API_URL, {
        method: 'POST',
        headers: {
            'Authorization': `Bearer ${token}`,
            'Content-Type': 'application/json'
        },
        body: JSON.stringify(jobData)
    });

    if (!response.ok) {
        const error = await response.json();
        throw new Error(error.message || 'Failed to create job');
    }

    return response.json();
};

export const updateJob = async (id, jobData) => {
    const token = getToken();

    const response = await fetch(`${API_URL}/${id}`, {
        method: 'PUT',
        headers: {
            'Authorization': `Bearer ${token}`,
            'Content-Type': 'application/json'
        },
        body: JSON.stringify(jobData)
    });

    if (!response.ok) {
        const error = await response.json();
        throw new Error(error.message || 'Failed to update job');
    }

    return response.json();
};

export const deleteJob = async (id) => {
    const token = getToken();

    const response = await fetch(`${API_URL}/${id}`, {
        method: 'DELETE',
        headers: {
            'Authorization': `Bearer ${token}`,
            'Content-Type': 'application/json'
        }
    });

    if (!response.ok) {
        const error = await response.json();
        throw new Error(error.message || 'Failed to delete job');
    }

    return response.json();
};