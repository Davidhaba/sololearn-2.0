const AuthService = (() => {
    return {
        register: async (email, password, name) => {
            const res = await fetch('/auth/register', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ email, password, name })
            });
            const data = await res.json();
            if (!res.ok) throw new Error(data.error);
            
            localStorage.setItem('authToken', data.token);
            localStorage.setItem('user', JSON.stringify(data.user));
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
            
            localStorage.setItem('authToken', data.token);
            localStorage.setItem('user', JSON.stringify(data.user));
            return data;
        },

        logout: () => {
            localStorage.removeItem('authToken');
            localStorage.removeItem('user');
        },

        getCurrentUser: async () => {
            const token = localStorage.getItem('authToken');
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
                    return null;
                }
                return data;
            } catch (err) {
                console.error('getCurrentUser error:', err);
                return null;
            }
        },

        isAuthenticated: () => {
            return !!localStorage.getItem('authToken');
        },

        getToken: () => {
            return localStorage.getItem('authToken');
        },

        getStoredUser: () => {
            const user = localStorage.getItem('user');
            return user ? JSON.parse(user) : null;
        }
    };
})();

