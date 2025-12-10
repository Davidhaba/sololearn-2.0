const AuthService = (() => {
    let authToken, currentUser;
    return {
        register: async (email, password, name) => {
            const res = await fetch('/auth/register', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ email, password, name })
            });
            const data = await res.json();
            if (!res.ok) throw new Error(data.error);
            try {
                localStorage.setItem('authToken', data.token);
                localStorage.setItem('user', JSON.stringify(data.user));
            } catch { }
            authToken = data.token;
            currentUser = data.user;
            return data;
        },

        login: async (email, password) => {
            const res = await fetch('/auth/login', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ email, password })
            });
            const data = await res.json();
            if (!res.ok) throw new Error(data.error);
            try {
                localStorage.setItem('authToken', data.token);
                localStorage.setItem('user', JSON.stringify(data.user));
            } catch { }
            authToken = data.token;
            currentUser = data.user;
            return data;
        },

        logout: () => {
            localStorage.removeItem('authToken');
            localStorage.removeItem('user');
            authToken = null;
            currentUser = null;
        },

        getCurrentUser: async () => {
            const token = getToken();
            if (!token) return null;

            try {
                const res = await fetch('/auth/me', {
                    method: 'GET',
                    headers: {
                        'Authorization': `Bearer ${token}`,
                        'Content-Type': 'application/json'
                    }
                });
                const data = await res.json();
                console.log(data);
                if (!res.ok) {
                    localStorage.removeItem('authToken');
                    localStorage.removeItem('user');
                    authToken = null;
                    currentUser = null;
                    throw new Error(data.error || 'Failed to fetch user');
                } else {
                    try {
                        localStorage.setItem('user', JSON.stringify(data.user));
                    } catch { }
                    currentUser = data.user;
                    return data;
                }
            } catch (err) {
                console.error('getCurrentUser error:', err);
                return null;
            }
        },

        isAuthenticated: () => {
            const token = getToken();
            return token ? !!token : false;
        },

        getToken: () => {
            let token;
            try {
                token = localStorage.getItem('authToken') || authToken;
            } catch {
                token = authToken;
            }
            return token || null;
        },

        getStoredUser: () => {
            let user;
            try {
                user = JSON.parse(localStorage.getItem('user')) || currentUser;
            } catch {
                user = currentUser;
            }
            return user || null;
        }
    };
})();

