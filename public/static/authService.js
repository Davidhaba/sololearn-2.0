const AuthService = (() => {
    let authToken, currentUser;
    return {
        register: async function (email, password, name) {
            const res = await fetch(Router.routers.authRegister, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ email, password, name })
            });
            const data = await res.json();
            if (!res.ok) throw new Error(data.error);
            try {
                localStorage.setItem('authToken', data.token);
            } catch { }
            authToken = data.token;
            this.setCurrentUser(data.user);
            return data;
        },

        login: async function (email, password) {
            const res = await fetch(Router.routers.authLogin, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ email, password })
            });
            const data = await res.json();
            if (!res.ok) throw new Error(data.error);
            try {
                localStorage.setItem('authToken', data.token);
            } catch { }
            authToken = data.token;
            this.setCurrentUser(data.user);
            return data;
        },

        logout: function () {
            try {
                localStorage.removeItem('authToken');
                localStorage.removeItem('user');
            } catch (err) { }
            authToken = null;
            currentUser = null;
        },

        getToken: function () {
            if (!authToken) {
                try {
                    const token = localStorage.getItem('authToken') || null;
                    if (token) authToken = token;
                } catch (err) { }
            }
            return authToken || null;
        },

        getCurrentUser: async function () {
            const token = this.getToken();
            if (!token) return null;
            try {
                const res = await fetch(Router.routers.apiUser, {
                    method: 'GET',
                    headers: {
                        'Authorization': `Bearer ${token}`,
                        'Content-Type': 'application/json'
                    }
                });
                const data = await res.json();
                if (!res.ok) {
                    throw new Error('Failed to fetch user');
                } else if (data?.error) {
                    localStorage.removeItem('authToken');
                    localStorage.removeItem('user');
                    authToken = null;
                    currentUser = null;
                    throw new Error(data.error);
                } else if (data?.user) {
                    this.setCurrentUser(data.user);
                    return currentUser;
                }
            } catch (e) {
                console.error('getCurrentUser error:', e);
                return null;
            }
        },

        getAllUsers: async function () {
            const token = this.getToken();
            if (!token) return null;
            try {
                const res = await fetch(Router.routers.apiUsers, {
                    method: 'GET',
                    headers: {
                        'Authorization': `Bearer ${token}`,
                        'Content-Type': 'application/json'
                    }
                });
                const data = await res.json();
                if (!res.ok || data.error) {
                    throw new Error(data.error || res.status);
                }
                return data;
            } catch (e) {
                console.error('getAllUsers error:', e);
                return null;
            }
        },

        isAuthenticated: function () {
            const token = this.getToken();
            return token ? !!token : false;
        },

        getStoredUser: function () {
            if (!currentUser) {
                try {
                    const user = JSON.parse(localStorage.getItem('user')) || null;
                    if (user) {
                        currentUser = user;
                    }
                } catch { }
            }
            return currentUser || null;
        },

        setCurrentUser: function (user = null) {
            const oldUser = currentUser;
            currentUser = user;
            try {
                localStorage.setItem('user', JSON.stringify(user));
            } catch { }
            if (oldUser?.id && typeof AppState !== 'undefined' && Array.isArray(AppState?.users)) {
                const i = AppState.users.findIndex(u => u && u.id && String(u.id) === String(oldUser.id));
                if (i !== -1) AppState.users[i] = user;
            }
        }
    };
})();
