const Router = (() => {
    const routers = {
        auth: '/auth',
        authLogin: '/auth#login',
        dashboard: '/dashboard',
        playground: '/playground',
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
        const isAuth = await checkAuth();
        const currentPage = '/' + window.location.pathname.split('/').pop() || '';

        if (!isAuth && currentPage !== routers.auth) {
            redirectTo(routers.auth);
        } else if (isAuth && currentPage === routers.auth) {
            console.log('✅ Already logged in, redirecting to dashboard...');
            redirectTo(routers.dashboard);
        }
    };

    return { init, redirectTo, checkAuth, routers };
})();
window.addEventListener('DOMContentLoaded', () => {
    Router.init();
});
