const firebaseConfig = {
  apiKey: "AIzaSyDf77lCIv3_gJcEt5PbkI0eV5Jm-NlvjBc",
  authDomain: "sololearn-2-0.firebaseapp.com",
  projectId: "sololearn-2-0",
  storageBucket: "sololearn-2-0.firebasestorage.app",
  messagingSenderId: "140191799026",
  appId: "1:140191799026:web:a606ff0a712f3771cca26b",
  measurementId: "G-0M6D4THRMF"
};

if (typeof firebase === 'undefined') {
    console.error('Firebase SDK not loaded. Check that firebase-app-compat.js and firebase-auth-compat.js are loaded.');
}

firebase.initializeApp(firebaseConfig);
const auth = firebase.auth();

const GoogleAuthProvider = new firebase.auth.GoogleAuthProvider();
const FacebookAuthProvider = new firebase.auth.FacebookAuthProvider();
const GithubAuthProvider = new firebase.auth.GithubAuthProvider();
const MicrosoftAuthProvider = new firebase.auth.OAuthProvider('microsoft.com');

GoogleAuthProvider.addScope('profile');
GoogleAuthProvider.addScope('email');

FacebookAuthProvider.addScope('email');
FacebookAuthProvider.addScope('public_profile');

GithubAuthProvider.addScope('user:email');
GithubAuthProvider.addScope('read:user');

MicrosoftAuthProvider.addScope('profile');
MicrosoftAuthProvider.addScope('email');
MicrosoftAuthProvider.setCustomParameters({
    prompt: 'consent'
});

async function handleOAuthRedirect() {
    try {
        const result = await auth.getRedirectResult();
        if (result.user) {
            await handleOAuthSuccess(result.user, result.credential);
        }
    } catch (error) {
        console.error('OAuth redirect error:', error);
        showMessage(`❌ ${error.message}`, 'error');
    }
}

async function handleOAuthSuccess(user, credential) {
    try {
        const token = await user.getIdToken();
        
        const response = await fetch('/auth/oauth', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
                idToken: token,
                provider: user.providerData[0]?.providerId || 'unknown',
                name: user.displayName || user.email.split('@')[0],
                email: user.email,
                photo: user.photoURL || ''
            })
        });

        const data = await response.json();
        if (!response.ok) throw new Error(data.error || 'OAuth login failed');

        localStorage.setItem('authToken', data.token);
        localStorage.setItem('user', JSON.stringify(data.user));

        showMessage('✅ Login successful! Redirecting...', 'success');
        setTimeout(() => {
            if (typeof Router !== 'undefined' && Router.routers?.dashboard) {
                Router.redirectTo(Router.routers.dashboard);
            }
        }, 100);
    } catch (err) {
        console.error('OAuth success handler error:', err);
        showMessage(`❌ ${err.message}`, 'error');
    }
}

Object.assign(AuthService, {
    loginWithGoogle: async function() {
        try {
            const result = await auth.signInWithPopup(GoogleAuthProvider);
            await handleOAuthSuccess(result.user, result.credential);
        } catch (error) {
            if (error.code !== 'auth/popup-closed-by-user' && error.code !== 'auth/cancelled-popup-request') {
                showMessage(`❌ Google login failed: ${error.message}`, 'error');
            }
            console.error('Google login error:', error);
        }
    },

    loginWithFacebook: async function() {
        try {
            const result = await auth.signInWithPopup(FacebookAuthProvider);
            await handleOAuthSuccess(result.user, result.credential);
        } catch (error) {
            if (error.code !== 'auth/popup-closed-by-user' && error.code !== 'auth/cancelled-popup-request') {
                showMessage(`❌ Facebook login failed: ${error.message}`, 'error');
            }
            console.error('Facebook login error:', error);
        }
    },

    loginWithGithub: async function() {
        try {
            const result = await auth.signInWithPopup(GithubAuthProvider);
            await handleOAuthSuccess(result.user, result.credential);
        } catch (error) {
            if (error.code !== 'auth/popup-closed-by-user' && error.code !== 'auth/cancelled-popup-request') {
                showMessage(`❌ GitHub login failed: ${error.message}`, 'error');
            }
            console.error('GitHub login error:', error);
        }
    },

    loginWithMicrosoft: async function() {
        try {
            const result = await auth.signInWithPopup(MicrosoftAuthProvider);
            await handleOAuthSuccess(result.user, result.credential);
        } catch (error) {
            if (error.code !== 'auth/popup-closed-by-user' && error.code !== 'auth/cancelled-popup-request') {
                showMessage(`❌ Microsoft login failed: ${error.message}`, 'error');
            }
            console.error('Microsoft login error:', error);
        }
    }
});

if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', handleOAuthRedirect);
} else {
    handleOAuthRedirect();
}
