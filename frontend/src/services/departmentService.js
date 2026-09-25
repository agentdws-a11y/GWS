import { getToken } from '../utils/auth';

const API_URL = 'http://localhost:5000/api/departments';

export const getAllDepartments = async () => {
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
        throw new Error(error.message || 'Failed to fetch departments');
    }

    return response.json();
};

export const getDepartmentById = async (id) => {
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
        throw new Error(error.message || 'Failed to fetch department');
    }

    return response.json();
};

export const createDepartment = async (departmentData) => {
    const token = getToken();

    const response = await fetch(API_URL, {
        method: 'POST',
        headers: {
            'Authorization': `Bearer ${token}`,
            'Content-Type': 'application/json'
        },
        body: JSON.stringify(departmentData)
    });

    if (!response.ok) {
        const error = await response.json();
        throw new Error(error.message || 'Failed to create department');
    }

    return response.json();
};

export const updateDepartment = async (id, departmentData) => {
    const token = getToken();

    const response = await fetch(`${API_URL}/${id}`, {
        method: 'PUT',
        headers: {
            'Authorization': `Bearer ${token}`,
            'Content-Type': 'application/json'
        },
        body: JSON.stringify(departmentData)
    });

    if (!response.ok) {
        const error = await response.json();
        throw new Error(error.message || 'Failed to update department');
    }

    return response.json();
};

export const deleteDepartment = async (id) => {
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
        throw new Error(error.message || 'Failed to delete department');
    }

    return response.json();
};

export const getManagersList = async () => {
    const token = getToken();

    const response = await fetch(`${API_URL}/managers/list`, {
        method: 'GET',
        headers: {
            'Authorization': `Bearer ${token}`,
            'Content-Type': 'application/json'
        }
    });

    if (!response.ok) {
        const error = await response.json();
        throw new Error(error.message || 'Failed to fetch managers');
    }

    return response.json();
};
