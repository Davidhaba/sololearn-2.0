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
            let token;
            try {
                token = localStorage.getItem('authToken');
            } catch {
                token = authToken;
            }
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
                if (!res.ok) {
                    localStorage.removeItem('authToken');
                    localStorage.removeItem('user');
                    authToken = null;
                    currentUser = null;
                    return null;
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
            let token;
            try {
                token = localStorage.getItem('authToken');
            } catch {
                token = authToken;
            }
            return !!token;
        },

        getToken: () => {
            let token;
            try {
                token = localStorage.getItem('authToken');
            } catch {
                token = authToken;
            }
            return token;
        },

        getStoredUser: () => {
            let user;
            try {
                user = JSON.parse(localStorage.getItem('user')) || currentUser || null;
            } catch {
                user = currentUser || null;
            }
            return user;
        }
    };
})();

