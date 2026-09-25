const TOKEN_KEY = 'hyre_ai_token';
const USER_KEY = 'hyre_ai_user';

export const saveToken = (token) => {
    localStorage.setItem(TOKEN_KEY, token);
};

export const getToken = () => {
    return localStorage.getItem(TOKEN_KEY);
};

export const saveUser = (user) => {
    localStorage.setItem(USER_KEY, JSON.stringify(user));
};

export const getUser = () => {
    const user = localStorage.getItem(USER_KEY);

    if (!user) {
        return null;
    }

    return JSON.parse(user);
};

export const removeToken = () => {
    localStorage.removeItem(TOKEN_KEY);
};

export const removeUser = () => {
    localStorage.removeItem(USER_KEY);
};


export const clearAuth = () => {
    removeToken();
    removeUser();
};
