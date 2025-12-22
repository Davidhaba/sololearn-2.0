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
                localStorage.setItem('user', JSON.stringify(data.user));
            } catch { }
            authToken = data.token;
            currentUser = data.user;
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
                localStorage.setItem('user', JSON.stringify(data.user));
            } catch { }
            authToken = data.token;
            currentUser = data.user;
            return data;
        },

        logout: function () {
            localStorage.removeItem('authToken');
            localStorage.removeItem('user');
            authToken = null;
            currentUser = null;
        },

        getToken: function () {
            let token;
            try {
                token = localStorage.getItem('authToken') || authToken;
            } catch {
                token = authToken;
            }
            return token || null;
        },

        getCurrentUser: async function () {
            const token = this.getToken();
            if (!token) return null;

            try {
                const res = await fetch(Router.routers.authMe, {
                    method: 'GET',
                    headers: {
                        'Authorization': `Bearer ${token}`,
                        'Content-Type': 'application/json'
                    }
                });
                const data = await res.json();
                if (!res.ok || data.error) {
                    localStorage.removeItem('authToken');
                    localStorage.removeItem('user');
                    authToken = null;
                    currentUser = null;
                    throw new Error(data.error || 'Failed to fetch user');
                } else {
                    const userObj = data && data.user;
                    try {
                        localStorage.setItem('user', JSON.stringify(userObj));
                    } catch { }
                    currentUser = userObj;
                    return userObj;
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
