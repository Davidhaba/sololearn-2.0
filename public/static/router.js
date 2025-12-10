const Router = (() => {
    const PUBLIC_PAGES = ['dashboard', '/auth', '/index', '/'];

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

    const isPublicPage = () => {
        const path = window.location.pathname;
        return PUBLIC_PAGES.some(page => path.includes(page));
    };

    const init = async () => {
        const isAuth = await checkAuth();
        const currentPage = window.location.pathname.split('/').pop() || '/';

        if (!isAuth && currentPage !== "auth") {
            redirectTo('/auth');
        } else if (isAuth && currentPage !== "dashboard") {
            console.log('✅ Already logged in, redirecting to dashboard...');
            redirectTo('/dashboard');
        }
    };

    return { init, redirectTo, checkAuth, isPublicPage };
})();

document.addEventListener('DOMContentLoaded', () => {
    Router.init();
});

