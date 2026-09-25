export const validateEmail = (email) => {
    if (!email.trim()) {
        return 'Email is required';
    }

    const emailPattern = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

    if (!emailPattern.test(email)) {
        return 'Please enter a valid email address';
    }

    return '';
};

export const validatePassword = (password) => {
    if (!password) {
        return 'Password is required';
    }

    if (password.length < 8) {
        return 'Password must be at least 8 characters';
    }

    if (!/[A-Z]/.test(password)) {
        return 'Password must contain at least 1 uppercase letter';
    }

    if (!/[a-z]/.test(password)) {
        return 'Password must contain at least 1 lowercase letter';
    }

    if (!/[0-9]/.test(password)) {
        return 'Password must contain at least 1 number';
    }

    if (!/[!@#$%^&*(),.?":{}|<>_\-\\[\]/`~+=;' ]/.test(password)) {
        return 'Password must contain at least 1 special character';
    }

    return '';
};

export const validateName = (name) => {
    if (!name.trim()) {
        return 'Name is required';
    }

    if (name.trim().length < 2) {
        return 'Name must be at least 2 characters';
    }

    return '';
};

export const validateConfirmPassword = (password, confirmPassword) => {
    if (!confirmPassword) {
        return 'Please confirm your password';
    }

    if (password !== confirmPassword) {
        return 'Passwords do not match';
    }

    return '';
};