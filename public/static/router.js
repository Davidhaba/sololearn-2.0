const Router = (() => {
    const apiBase = `/api`;
    const auth = `/auth`;
    const apiUsers = `${apiBase}/users`;
    const routers = {
        pageNotFound: '/pagenotfound',
        apiBase,
        auth,
        login: `${auth}#login`,
        dashboard: '/dashboard',
        playground: '/playground',
        authRegister: `${auth}/register`,
        authLogin: `${auth}/login`,
        apiUsers,
        apiUser: `${apiUsers}/user`,
        authNotifications: `${auth}/notifications`,
        apiCodes: `${apiBase}/codes`,
    };
    const redirectTo = (page) => {
        window.location.href = page;
    };

    const checkAuth = async () => {
        if (!AuthService.isAuthenticated()) {
            return false;
        }
        const user = await AuthService.getCurrentUser();
        if (!user) {
            AuthService.logout();
            return false;
        }
        return true;
    };

    const init = async () => {
        try {
            const isAuth = await checkAuth();
            let path = window.location.pathname.trim();
            if (path.endsWith('/')) path = path.slice(0, -1);
            const currentPage = '/' + (path.split('/').pop() || '');
            if (!isAuth && currentPage !== routers.auth) {
                redirectTo(routers.auth);
            } else if (isAuth && (currentPage === routers.auth || currentPage === '/' || currentPage === '/index')) {
                console.log('✅ Already logged in, redirecting to dashboard...');
                redirectTo(routers.dashboard);
            }
        } catch (e) {
            if (e?.message) console.error(e.message);
            else console.error('Redirecting error.');
        }
    };

    return { init, redirectTo, checkAuth, routers };
})();
window.addEventListener('DOMContentLoaded', () => {
    Router.init();
});
