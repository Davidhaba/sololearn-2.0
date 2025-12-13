const AppState = {
    currentScreen: 'main',
    users: null,
    currentUser: null,
    notifications: [],
    currentEditingCode: null,
    consoleMessages: []
};

function getToken() {
    return (typeof AuthService !== 'undefined') ? AuthService.getToken() || null : null;
}

(function captureConsole() {
    if (typeof window === 'undefined' || !window.console) return;
    const levels = ['log', 'info', 'warn', 'error', 'debug'];
    levels.forEach(level => {
        const orig = console[level] || console.log;
        console[level] = function (...args) {
            try {
                const text = args.map(a => {
                    try { return (typeof a === 'object') ? JSON.stringify(a) : String(a); } catch { return String(a); }
                }).join(' ');
                AppState.consoleMessages = AppState.consoleMessages || [];
                AppState.consoleMessages.push({ level, text, timestamp: Date.now() });
                updateConsoleCount();
            } catch (e) { }
            try { orig.apply(console, args); } catch (e) { }
        };
    });
})();

function updateConsoleCount() {
    try {
        const btn = document.getElementById('errorsCount');
        if (!btn) return;
        const msgs = Array.isArray(AppState.consoleMessages) ? AppState.consoleMessages : [];
        const errs = msgs.filter(m => m.level === 'error' || m.level === 'warn');
        const count = String(errs.length || msgs.length || 0);
        btn.textContent = count;
        if (count !== '0') btn.style.display = '';
        else btn.style.display = 'none';
    } catch { }
}

function getAuthStoredUser() {
    if (AppState.currentUser && AppState.currentUser.id) return AppState.currentUser;
    const authStored = typeof AuthService?.getStoredUser === 'function' ? AuthService.getStoredUser() : null;
    if (authStored && authStored.id) {
        AppState.currentUser = authStored;
        return authStored;
    }
    return null;
}

async function fetchUsersFromApi() {
    try {
        const response = await fetch('/api/users', {
            method: 'GET', headers: { 'Authorization': `Bearer ${getToken()}`, 'Content-Type': 'application/json' }
        });

        if (!response.ok) throw new Error(response.status);
        const data = await response.json();
        return Array.isArray(data) ? data : null;
    } catch (err) {
        throw new Error(err.message);
    }
}

async function initApp() {
    try {
        const currentUser = await AuthService?.getCurrentUser() || null;
        if (currentUser) {
            AppState.currentUser = currentUser;
        }
        updateProfileImage(AppState.currentUser);
    } catch (e) {
        console.warn('Failed to get current user:', e);
    }
    try {
        await updateUsers();
    } catch (e) {
        console.warn('Failed to update users:', e);
    }
    initializeEventListeners();
    initializeCodeTab();
    updateMenuAuthButton();
    changeScreen('main');
}

if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', initApp);
} else {
    initApp();
}

function updateNotifEl(u = null) {
    const notifEl = document.getElementById('notifCount');
    if (!u) u = getAuthStoredUser();
    if (notifEl && u) {
        if (u.notifications && u.notifications.length >= 1) {
            notifEl.textContent = u.notifications.length || 0;
            notifEl.style.display = 'block';
        } else {
            notifEl.textContent = '0';
            notifEl.style.display = 'none';
        }
    }
}

async function renderNotifications() {
    const container = document.getElementById('notificationsScreen');
    if (!container) return;
    try { await updateUsers(); } catch { }
    const user = getAuthStoredUser();
    updateNotifEl(user);
    const notes = Array.isArray(user?.notifications) ? user.notifications : [];
    container.innerHTML = '';
    if (!notes || notes.length === 0) {
        const empty = document.createElement('div');
        empty.style.cssText = `
            text-align: center;
            padding: 40px 20px;
            color: var(--text-secondary);
        `;
        empty.innerHTML = `
            <div style="font-size: 32px; margin-bottom: 12px; opacity: 0.5;">
                <i class="fas fa-bell-slash"></i>
            </div>
            <p style="margin: 0; font-size: 14px;">No notifications yet</p>
        `;
        container.appendChild(empty);
        return;
    }
    const header = document.createElement('div');
    header.style.cssText = `
        display: flex;
        justify-content: flex-end;
        align-items: center;
        margin-bottom: 16px;
        gap: 8px;
    `;
    const actions = document.createElement('div');
    actions.style.cssText = 'display: flex; gap: 8px;';
    actions.innerHTML = `
        <button id="markAllReadBtn" class="secondary-button" style="padding: 8px 12px; font-size: 13px;">
            <i class="fas fa-check-double"></i> Mark all read
        </button>
        <button id="clearNotifBtn" class="secondary-button" style="padding: 8px 12px; font-size: 13px;">
            <i class="fas fa-trash"></i> Clear all
        </button>
    `;
    header.appendChild(actions);
    container.appendChild(header);
    const list = document.createElement('div');
    list.style.cssText = 'display: grid; gap: 12px;';
    notes.forEach((n, idx) => {
        const it = document.createElement('div');
        it.className = 'notifItem';
        it.setAttribute('data-idx', String(idx));
        it.style.cssText = `
            padding: 16px;
            border-radius: 8px;
            background: rgba(255, 255, 255, 0.02);
            border: 1px solid rgba(255, 255, 255, 0.06);
            display: flex;
            justify-content: space-between;
            align-items: flex-start;
            gap: 12px;
            ${n.read ? '' : 'border-left: 3px solid #6366f1; background: rgba(99, 102, 241, 0.05);'}
        `;
        const left = document.createElement('div');
        left.style.cssText = 'flex: 1;';
        const title = document.createElement('div');
        title.style.cssText = 'font-weight: 600; font-size: 15px; color: var(--text-primary); margin-bottom: 4px;';
        title.textContent = n.title || (n.text ? String(n.text).slice(0, 60) + (n.text.length > 60 ? '...' : '') : 'Notification');
        const msg = document.createElement('div');
        msg.style.cssText = 'color: var(--text-secondary); font-size: 13px; line-height: 1.4;';
        msg.textContent = n.message || n.text || '';
        left.appendChild(title);
        left.appendChild(msg);
        const right = document.createElement('div');
        right.style.cssText = 'display: flex; flex-direction: column; align-items: flex-end; gap: 6px; min-width: 80px;';
        const time = document.createElement('div');
        time.style.cssText = 'font-size: 11px; color: var(--text-secondary);';
        time.textContent = new Date(n.timestamp || Date.now()).toLocaleString();
        const markBtn = document.createElement('button');
        markBtn.className = 'secondary-button markReadBtn';
        markBtn.style.cssText = `
            padding: 4px 8px;
            border-radius: 4px;
            font-size: 11px;
            ${n.read ? 'opacity: 0.5; cursor: not-allowed;' : ''}
        `;
        markBtn.textContent = n.read ? 'Read' : 'Mark read';
        markBtn.disabled = !!n.read;
        markBtn.addEventListener('click', (e) => {
            e.stopPropagation();
            markNotificationRead(idx);
            renderNotifications();
        });
        right.appendChild(time);
        right.appendChild(markBtn);
        it.appendChild(left);
        it.appendChild(right);
        list.appendChild(it);
    });
    container.appendChild(list);
    document.getElementById('markAllReadBtn')?.addEventListener('click', () => {
        markAllNotificationsRead();
        renderNotifications();
    });
    document.getElementById('clearNotifBtn')?.addEventListener('click', () => {
        if (confirm('Clear all notifications?')) {
            clearAllNotifications();
            renderNotifications();
        }
    });
}

function markNotificationRead(idx) {
    const user = getAuthStoredUser();
    if (!user || !Array.isArray(user.notifications)) return;
    if (!user.notifications[idx]) return;

    const notification = user.notifications[idx];
    notification.read = true;
    updateNotifEl(user);
    persistNotificationOperation('mark_read', { notificationId: notification.id }).catch(() => { });
}

function markAllNotificationsRead() {
    const user = getAuthStoredUser();
    if (!user || !Array.isArray(user.notifications)) return;
    const unreadIds = user.notifications
        .filter(n => !n.read)
        .map(n => n.id);
    if (unreadIds.length === 0) return;
    user.notifications = user.notifications.map(n => ({ ...n, read: true }));
    updateNotifEl(user);
    persistNotificationOperation('mark_all_read', { notificationIds: unreadIds }).catch(() => { });
}

function clearAllNotifications() {
    const user = getAuthStoredUser();
    if (!user) return;
    const notificationIds = user.notifications.map(n => n.id);
    user.notifications = [];
    updateNotifEl(user);
    persistNotificationOperation('clear_all', { notificationIds }).catch(() => { });
}

async function persistNotificationOperation(action, data) {
    if (typeof AuthService === 'undefined' || !AuthService.isAuthenticated()) return;
    try {
        const res = await fetch('/auth/notifications', {
            method: 'PUT',
            headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${getToken()}` },
            body: JSON.stringify({ action, ...data })
        });
        const resData = await res.json();
        if (!res.ok) {
            if (resData.error) throw new Error(resData.error);
            if (res.status) throw new Error(`status ${res.status}`);
            throw new Error('Unknown error');
        }
        if (resData.user) AppState.currentUser = resData.user;
    } catch (e) {
        console.warn('Failed to persist notification operation.', e);
    }
}

function initializeEventListeners() {
    const currentUser = getAuthStoredUser();
    const streakEl = document.getElementById('streakCount');
    const livesEl = document.getElementById('livesCount');
    if (currentUser) {
        if (streakEl) streakEl.textContent = currentUser.streak || 0;
        if (livesEl) livesEl.textContent = currentUser.lives || 0;
        updateNotifEl(currentUser);
    }

    document.querySelectorAll('[data-open-screen]').forEach(button => {
        button.addEventListener('click', (e) => {
            const screenId = button.getAttribute('data-open-screen');
            changeScreen(screenId);
            if (screenId === 'userProfile') {
                const currentUser = getAuthStoredUser();
                loadProfileById(currentUser?.id || null);
                updateProfileImage(currentUser);
            }
            else if (screenId === 'leaders') loadLeaderboard();
            else if (screenId === 'code') displayCodes('trending');
            else if (screenId === 'notificationsScreen') renderNotifications();
        });
    });

    document.getElementById('favBtn').addEventListener('click', () => {
        const currentUser = getAuthStoredUser();
        if (currentUser && currentUser.lives && currentUser.lives >= 1) {
            showNotification(`❤️ You have ${currentUser.lives || 0} lives!`);
            if (livesEl) livesEl.textContent = currentUser.lives || 0;
        } else {
            showNotification("You have no lives.");
            if (livesEl) livesEl.textContent = '0';
        }
    });

    document.getElementById('streakBtn').addEventListener('click', () => {
        const currentUser = getAuthStoredUser();
        if (currentUser && currentUser.streak && currentUser.streak >= 1) {
            showNotification(`🔥 Your current streak: ${currentUser.streak || 0} days!`);
            if (streakEl) streakEl.textContent = currentUser.streak || 0;
        } else {
            showNotification("You have no active streak.");
            if (streakEl) streakEl.textContent = '0';
        }
    });

    document.getElementById('menuBtn').addEventListener('click', () => {
        toggleSideMenu();
    });

    const closeBtn = document.getElementById('closeSideMenu');
    if (closeBtn) closeBtn.addEventListener('click', closeSideMenu);
    const consoleBtn = document.getElementById('consoleBtn');
    if (consoleBtn) consoleBtn.addEventListener('click', (e) => {
        openConsoleModal();
    });
    const menuOverlay = document.getElementById('sideMenuOverlay');
    if (menuOverlay) menuOverlay.addEventListener('click', (e) => {
        if (e.target === menuOverlay) closeSideMenu();
    });
    document.querySelectorAll('#sideMenu .menuItem').forEach(btn => {
        btn.addEventListener('click', (e) => {
            closeSideMenu();
        });
    });

    const sideProfile = document.getElementById('sideMenuProfile');
    if (sideProfile) {
        sideProfile.addEventListener('click', () => {
            changeScreen('userProfile');
            const user = getAuthStoredUser();
            loadProfileById(user?.id);
            closeSideMenu();
        });
        sideProfile.addEventListener('keydown', (e) => {
            if (e.key === 'Enter') {
                e.preventDefault();
                sideProfile.click();
            }
        });
        sideProfile.addEventListener('keyup', (e) => {
            if (e.key === ' ') {
                e.preventDefault();
                sideProfile.click();
            }
        });
    }

    const profileSaveBtn = document.getElementById('profileSaveBtn');
    const profileCancelBtn = document.getElementById('profileCancelBtn');
    if (profileSaveBtn) profileSaveBtn.addEventListener('click', (e) => saveProfileChanges(e.target));
    if (profileCancelBtn) profileCancelBtn.addEventListener('click', cancelProfileEdit);
}

function updateMenuAuthButton() {
    const btn = document.getElementById('menuLogoutBtn');
    if (!btn) return;

    const isAuthenticated = typeof AuthService !== 'undefined' && AuthService.isAuthenticated();

    if (isAuthenticated) {
        btn.textContent = 'Log out';
        btn.className = 'primary-button red-back-btn';
        btn.onclick = () => {
            closeSideMenu();
            handleLogout();
        };
    } else {
        btn.textContent = 'Log in';
        btn.className = 'primary-button';
        btn.onclick = () => {
            closeSideMenu();
            if (typeof Router !== 'undefined' && Router.redirectTo) {
                Router.redirectTo('/auth');
            } else {
                alert('Please log in via the /auth page.');
            }
        };
    }
}

function openConsoleModal() {
    const modal = document.getElementById('consoleModal');
    const list = document.getElementById('consoleMessages');
    if (!modal || !list) return;
    renderConsoleMessages();
    modal.style.display = 'flex';
    document.getElementById('closeConsoleBtn')?.focus();
    document.getElementById('closeConsoleBtn')?.addEventListener('click', closeConsoleModal);
    document.getElementById('clearConsoleBtn')?.addEventListener('click', clearConsoleMessages);
}

function closeConsoleModal() {
    const modal = document.getElementById('consoleModal');
    if (modal) modal.style.display = 'none';
}

function clearConsoleMessages() {
    AppState.consoleMessages = [];
    updateConsoleCount();
    renderConsoleMessages();
}

function renderConsoleMessages() {
    const list = document.getElementById('consoleMessages');
    if (!list) return;
    const msgs = Array.isArray(AppState.consoleMessages) && AppState.consoleMessages.length ? AppState.consoleMessages : [];
    if (msgs.length === 0) {
        list.innerHTML = '<div style="color:var(--text-secondary);">No messages yet.</div>';
        return;
    }
    list.innerHTML = msgs.map(m => {
        const time = new Date(m.timestamp).toLocaleTimeString();
        const color = m.level === 'error' ? '#ff6b6b' : (m.level === 'warn' ? '#f59e0b' : 'var(--text-primary)');
        return `<div style="padding:6px 8px;border-bottom:1px solid rgba(255,255,255,0.02);"><div style=\"font-size:11px;color:${color};font-weight:600;\">[${m.level}] ${time}</div><div style=\"font-family:monospace;white-space:pre-wrap;color:var(--text-primary);\">${escapeHtml(String(m.text))}</div></div>`;
    }).join('');
    list.scrollTop = list.scrollHeight;
}

function openProfileEditor() {
    const user = getAuthStoredUser();
    if (!user) return;
    const nameIn = document.getElementById('profileEditorName');
    const photoIn = document.getElementById('profileEditorPhoto');
    if (nameIn) nameIn.value = user.name || '';
    if (photoIn) photoIn.value = user.photo || '';
    changeScreen('profileEditor');
    const btn = document.getElementById('profileSaveBtn');
    if (btn) {
        btn.innerHTML = '<i class="fas fa-check"></i> Save';
        btn.disabled = false;
    }
}

async function saveProfileChanges(btn) {
    btn.disabled = true;
    btn.innerHTML = '<i class="fas fa-spinner fa-spin"></i> Saving...';
    const nameIn = document.getElementById('profileEditorName');
    const photoIn = document.getElementById('profileEditorPhoto');
    if (!nameIn || !photoIn) {
        btn.disabled = false;
        return;
    }
    const name = nameIn.value.trim();
    const photo = photoIn.value.trim();
    if (!name) {
        btn.disabled = false;
        showNotification('Please enter your name.');
        return;
    }
    if (typeof AuthService === 'undefined' || !AuthService.isAuthenticated()) {
        btn.disabled = false;
        showNotification('You are not authenticated.');
        return;
    }

    try {
        const res = await fetch('/auth/me', {
            method: 'PUT', headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${getToken()}` },
            body: JSON.stringify({ name, photo })
        });
        const data = await res.json();
        btn.disabled = false;
        if (!res.ok) throw new Error(data.error || `Status ${res.status}`);

        AppState.currentUser = data.user || AppState.currentUser;
        updateProfileImage(AppState.currentUser);
        const sideName = document.getElementById('sideMenuName');
        if (sideName) sideName.textContent = AppState.currentUser?.name || 'Unknown';
        const sideAvatar = document.getElementById('sideMenuAvatar');
        if (sideAvatar) sideAvatar.src = AppState.currentUser?.photo || createInitialsAvatar(AppState.currentUser?.name || 'Unknown');

        try { await updateUsers(); } catch (e) { }

        showNotification('Profile updated');
        changeScreen('userProfile');
        showUserProfile(AppState.currentUser);
    } catch (err) {
        btn.disabled = false;
        console.error('Failed to save profile:', err);
        showNotification('Failed to update profile');
    }
}

function cancelProfileEdit() {
    changeScreen('userProfile');
    const currentUser = getAuthStoredUser();
    if (currentUser && currentUser.id) {
        loadProfileById(currentUser.id);
    }
}

function toggleSideMenu() {
    const overlay = document.getElementById('sideMenuOverlay');
    if (!overlay) return;
    if (overlay.style.display === 'none' || overlay.style.display === '') {
        openSideMenu();
    } else {
        closeSideMenu();
    }
}

function openSideMenu() {
    const overlay = document.getElementById('sideMenuOverlay');
    const menu = document.getElementById('sideMenu');
    const avatar = document.getElementById('sideMenuAvatar');
    const nameEl = document.getElementById('sideMenuName');
    const user = getAuthStoredUser();

    if (nameEl) nameEl.textContent = user?.name || 'Unknown';
    if (avatar) avatar.outerHTML = createUserAvatar(user?.photo || null, user?.name || 'Unknown', avatar.attributes);
    if (overlay) {
        overlay.classList.add('show');
        overlay.querySelector('#sideMenuProfile')?.focus();
    }
    if (menu) menu.classList.add('show');
}

function closeSideMenu() {
    const overlay = document.getElementById('sideMenuOverlay');
    if (overlay) overlay.classList.remove('show');
    const menu = document.getElementById('sideMenu');
    if (menu) menu.classList.remove('show');
}

function changeScreen(screenId) {
    AppState.currentScreen = screenId;

    document.querySelectorAll('.appScreen').forEach(screen => {
        screen.classList.remove('active');
    });

    document.querySelectorAll('.downButton').forEach(button => {
        button.classList.remove('active');
    });

    document.getElementById(screenId).classList.add('active');

    const screenBtn = document.querySelector(`[data-screen="${screenId}"]`);
    if (screenBtn) {
        screenBtn.classList.add('active');
    }

    const screens = {
        'userProfile': -1,
        'main': 0,
        'leaders': 1,
        'code': 2,
        'notificationsScreen': 3,
    }
    const navEl = document.querySelector('#sideMenu #sideMenuNav');
    if (screens[screenId] !== -1) {
        navEl.style.setProperty('--button-index', screens[screenId] || 0);
        navEl.style.removeProperty('--hoverAnimWidth');
    } else {
        navEl.style.setProperty('--button-index', -1.68);
        navEl.style.setProperty('--hoverAnimWidth', '78%');
    }

    const titles = {
        'main': 'Home',
        'leaders': 'Leaderboard',
        'code': 'Code',
        'userProfile': 'Profile',
        'notificationsScreen': 'Notifications',
        'codeEditor': 'Code Editor',
        'profileEditor': 'Profile Editor'
    };
    document.getElementById('droptopTitle').textContent = titles[screenId] || screenId;
}

async function updateUsers() {
    const onlineUsers = await fetchUsersFromApi();
    if (onlineUsers && Array.isArray(onlineUsers) && onlineUsers.length) {
        AppState.users = onlineUsers;
        if (AuthService && typeof AuthService.getCurrentUser === 'function') {
            const storedUser = await AuthService.getCurrentUser();
            if (storedUser) AppState.currentUser = storedUser;
        }
        return;
    }
    throw new Error('No users data received from API');
}

async function loadProfileById(id = null) {
    const userScreen = document.getElementById('userProfile');
    userScreen.innerHTML = `<div style="color:var(--text-secondary)"><i class="fas fa-spinner fa-spin"></i> Loading profile...</div>`;

    const showFallback = () => {
        userScreen.innerHTML = `<div style="color:var(--text-secondary)">Failed to load profile</div>`;
    };
    try {
        await updateUsers();
    } catch { }
    try {
        if (!id) {
            throw new Error('Invalid user ID');
        }
        let user = getUserById(id);
        if (user) {
            showUserProfile(user);
            return;
        } else {
            throw new Error('User not found');
        }
    } catch (err) {
        showFallback();
        console.warn('Failed to load user profile:', err.message);
    }
}

function showUserProfile(user = null) {
    if (!user) return;
    const userScreen = document.getElementById('userProfile');
    const currentUser = getAuthStoredUser();
    const isCurrent = currentUser && currentUser.id && user.id && String(user.id) === String(currentUser.id);
    user = {
        name: user.name || 'Unknown',
        level: Number(user.level) || 0,
        xp: Number(user.xp) || 0,
        streak: Number(user.streak) || 0,
        achievements: user.achievements || [],
        photo: user.photo || ''
    };

    userScreen.innerHTML = `
        <div class="user-avatar">
            ${createUserAvatar(user.photo, user.name)}
        </div>
        <h2 style="margin-top:16px;margin-bottom:4px;">${user.name}</h2>
        <p style="color: var(--text-secondary); margin: 0 0 12px 0;">Level ${user.level}</p>
        ${(isCurrent ? `<button onclick="openProfileEditor()" class="primary-button" style="margin-top:4px;">Edit Profile</button>` : '')}
        
        <div style="width: 100%; margin-top: 24px; background: rgba(99, 102, 241, 0.1); border-radius: 12px; padding: 15px;">
            <p style="font-size: 12px; color: var(--text-secondary); margin: 0 0 8px 0;">Level Progress</p>
            <div style="width: 100%; height: 8px; background: rgba(99, 102, 241, 0.2); border-radius: 10px; overflow: hidden;">
                <div style="width: ${(user.xp / 5000) * 100}%; height: 100%; background: linear-gradient(90deg, var(--primary), var(--secondary)); transition: width 0.3s;"></div>
            </div>
            <p style="font-size: 12px; color: var(--text-secondary); margin: 8px 0 0 0;">${user.xp} / 5000 XP</p>
        </div>

        <div style="display: grid; grid-template-columns: 1fr 1fr; gap: 12px; margin-top: 20px; width: 100%;">
            <div style="background: rgba(99, 102, 241, 0.1); border-radius: 12px; padding: 15px; text-align: center;">
                <p style="font-size: 24px; margin: 0;">🔥 ${user.streak}</p>
                <p style="font-size: 12px; color: var(--text-secondary); margin: 5px 0 0 0;">Day Streak</p>
            </div>
            <div style="background: rgba(236, 72, 153, 0.1); border-radius: 12px; padding: 15px; text-align: center;">
                <p style="font-size: 24px; margin: 0;">🏆 ${user.achievements.length}</p>
                <p style="font-size: 12px; color: var(--text-secondary); margin: 5px 0 0 0;">Achievements</p>
            </div>
        </div>
    `;
}

function createUserAvatar(photoUrl, name, attrs = {}) {
    const fallbackAvatar = createInitialsAvatar(name);
    const src = (photoUrl && String(photoUrl).trim()) ? photoUrl : fallbackAvatar;
    const img = document.createElement('img');

    if (attrs && typeof attrs === 'object' && typeof attrs.length === 'number' && attrs.length > 0 && attrs[0] && attrs[0].name) {
        for (const a of attrs) {
            if (!a || !a.name) continue;
            if (a.name === 'src' || a.name === 'alt') continue;
            if (a.name === 'style') img.style.cssText = a.value;
            else img.setAttribute(a.name, a.value);
        }
    } else if (typeof Element !== 'undefined' && attrs instanceof Element) {
        for (const a of attrs.attributes) {
            if (!a || !a.name) continue;
            if (a.name === 'src' || a.name === 'alt') continue;
            if (a.name === 'style') img.style.cssText = a.value;
            else img.setAttribute(a.name, a.value);
        }
    } else if (typeof attrs === 'string' && attrs.trim()) {
        try {
            const tmp = document.createElement('div');
            tmp.innerHTML = `<img ${attrs}>`;
            const tmpImg = tmp.querySelector('img');
            if (tmpImg) {
                for (const a of tmpImg.attributes) {
                    if (!a || !a.name) continue;
                    if (a.name === 'src' || a.name === 'alt') continue;
                    if (a.name === 'style') img.style.cssText = a.value;
                    else img.setAttribute(a.name, a.value);
                }
            }
        } catch (e) { }
    } else if (attrs && typeof attrs === 'object') {
        Object.entries(attrs).forEach(([key, val]) => {
            if (val == null || val === '') return;
            if (key === 'class' || key === 'className') img.className = String(val);
            else if (key === 'style') {
                if (typeof val === 'string') img.style.cssText = val;
                else if (typeof val === 'object') Object.assign(img.style, val);
            } else {
                if (/^[0-9]+$/.test(String(key))) return;
                img.setAttribute(String(key), String(val));
            }
        });
    }
    img.src = src;
    img.alt = "Avatar";
    img.setAttribute('onerror', `if(this.src!=="${fallbackAvatar}"){this.src="${fallbackAvatar}";this.removeAttribute("onerror");}`);
    return img.outerHTML;
}

async function loadLeaderboard() {
    let errMsg;
    const leaderboardContent = document.getElementById('leaderboardContent');
    leaderboardContent.innerHTML = `
        <div style="display:flex;align-items:center;gap:12px;color:var(--text-secondary);">
            <div style="width:18px;height:18px;border-radius:50%;border:3px solid rgba(255,255,255,0.08);border-top-color:var(--primary);animation:spin 0.9s linear infinite"></div>
            <div>Loading leaderboard...</div>
        </div>
    `;
    try {
        await updateUsers();
    } catch (err) {
        errMsg = err.name === 'AbortError' ? 'Request timed out.' : '';
        const msg = errMsg ? errMsg : err.message || 'Unknown error.';
        console.warn(`Users fetch failed:`, msg);
    }
    try {
        const users = getUsersCache();
        if (users && Array.isArray(users)) {
            renderLeaderboard(users, leaderboardContent);
            return;
        }
    } catch (err) {
        console.warn(`Render leaderboard failed:`, err.message || 'Unknown error.');
    };
    showLeaderboardMessage(leaderboardContent, errMsg);
}

function renderLeaderboard(list, container) {
    if (!Array.isArray(list) || list.length === 0) {
        container.innerHTML = '<p style="color:var(--text-secondary);">No leaderboard entries yet.</p>';
        return;
    }

    const normalized = list.map(u => ({
        ...u,
        level: Number(u.level) || 0,
        xp: Number(u.xp) || 0,
    }));

    normalized.forEach((it, idx) => {
        it.rank = idx + 1;
        it.badge = computeBadge(it.rank);
    });

    normalized.sort((a, b) => {
        if (b.level !== a.level) return b.level - a.level;
        return b.xp - a.xp;
    });

    container.innerHTML = normalized.map((user, idx) => buildLeaderboardRow(user, idx)).join('');
    const links = container.querySelectorAll('[data-profile-idx]');
    links.forEach(link => {
        link.style.cursor = 'pointer';
        link.addEventListener('click', (ev) => {
            ev.preventDefault();
            const idx = Number(link.getAttribute('data-profile-idx'));
            const target = normalized[idx];
            if (target) {
                changeScreen('userProfile');
                loadProfileById(target?.id || null);
            }
        });
    });
    function computeBadge(rank) {
        if (rank === 1) return '🥇';
        if (rank === 2) return '🥈';
        if (rank === 3) return '🥉';
        return '⭐';
    }
}

function buildLeaderboardRow(user, idx) {
    const currentUser = getAuthStoredUser();
    const isCurrent = (currentUser && currentUser.id && user.id && String(user.id) === String(currentUser.id));
    return `
        <div style="display: flex; align-items: center; gap: 12px; padding: 14px; background: linear-gradient(135deg, rgba(99, 102, 241, 0.08), rgba(236, 72, 153, 0.05)); border-radius: 12px; margin-bottom: 10px; border: 1px solid rgba(148, 163, 184, 0.1); transition: all 0.3s;">
            <div style="font-size: 20px; width: 30px; text-align: center;">${user.badge || '•'}</div>
            <div style="width:36px;height:36px;flex:0 0 36px;border-radius:8px;overflow:hidden;">
                ${createUserAvatar(user.photo, user.name, `data-profile-idx="${idx}" style="width:100%;height:100%;object-fit:cover;display:block;"`)}
            </div>
            <div style="flex: 1;">
                <p style="margin: 0; font-weight: 600; color: var(--text-primary);">
                    <a data-profile-idx="${idx}">${escapeHtml(user.name ? (user.name + (isCurrent ? ' (You)' : '')) : isCurrent ? 'You' : 'Unknown')}</a>
                </p>
                <p style="margin: 4px 0 0 0; font-size: 12px; color: var(--text-secondary);">
                    <a data-profile-idx="${idx}">Level ${escapeHtml(user.level)} • ${Number(user.xp).toLocaleString()} pts</a>
                </p>
            </div>
            <div style="text-align: right; font-weight: 700; color: var(--primary-light);">#${user.rank}</div>
        </div>
    `;
}

function getUsersCache() {
    try {
        if (AppState.users && Array.isArray(AppState.users) && AppState.users.length) return AppState.users;
    } catch { }
    return null;
}

function showLeaderboardMessage(container, message) {
    container.innerHTML = '';

    const card = document.createElement('div');
    card.setAttribute('role', 'status');
    card.style.cssText = `
        max-width:720px;
        margin:10px auto;
        padding:18px 20px;
        background: linear-gradient(180deg, rgba(255,255,255,0.02), rgba(255,255,255,0.01));
        border-radius:12px;
        border:1px solid rgba(255,255,255,0.04);
        box-shadow: 0 12px 30px rgba(2,6,23,0.6);
        color: var(--text-primary);
        font-family: inherit;
    `;

    const header = document.createElement('div');
    header.style.cssText = 'display:flex;align-items:flex-start;gap:12px;';

    const icon = document.createElement('div');
    icon.innerHTML = '<svg width="36" height="36" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg" aria-hidden="true"><circle cx="12" cy="12" r="11" stroke="rgba(255,255,255,0.06)" stroke-width="2" fill="rgba(236,72,153,0.12)"/><path d="M11 7h2v6h-2zM11 15h2v2h-2z" fill="#ffb6c1"/></svg>';
    icon.style.cssText = 'flex:0 0 36px;';

    const textWrap = document.createElement('div');
    const title = document.createElement('div');
    title.style.cssText = 'font-weight:700;margin-bottom:6px;color:var(--text-primary);font-size:15px;';
    title.textContent = 'Unable to load leaderboard';

    const msg = document.createElement('div');
    msg.style.cssText = 'color:var(--text-secondary);font-size:13px;line-height:1.4;';
    msg.innerHTML = escapeHtml(String(message || 'Please try again later.'));

    textWrap.appendChild(title);
    textWrap.appendChild(msg);
    header.appendChild(icon);
    header.appendChild(textWrap);

    const actions = document.createElement('div');
    actions.style.cssText = 'display:flex;gap:10px;justify-content:flex-end;margin-top:14px;';

    const retry = document.createElement('button');
    retry.className = 'primary-button';
    retry.type = 'button';
    retry.innerHTML = '<span style="display:inline-flex;align-items:center;gap:8px;"><div class="fa fa-refresh"></div>Retry</span>';
    retry.style.cssText = 'padding:8px 12px;';
    retry.addEventListener('click', async () => {
        retry.disabled = true;
        await loadLeaderboard();
    });

    const report = document.createElement('button');
    report.className = 'secondary-button';
    report.type = 'button';
    report.style.cssText = 'padding:8px 12px;';
    report.innerHTML = '<span style="display:inline-flex;align-items:center;gap:8px;"><div class="fa fa-flag"></div>Report</span>';
    report.addEventListener('click', () => {
        const subject = 'Leaderboard load error';
        const body = `I could not load the leaderboard on ${location.href} at ${new Date().toLocaleString()}.
\n\nPlease include any steps to reproduce and your browser/OS.`;
        showReportModal('samsung22vs23@gmail.com', subject, body);
    });

    actions.appendChild(report);
    actions.appendChild(retry);

    card.appendChild(header);
    card.appendChild(actions);
    container.appendChild(card);
}

function escapeHtml(str) {
    return String(str)
        .replace(/&/g, '&amp;')
        .replace(/</g, '&lt;')
        .replace(/>/g, '&gt;')
        .replace(/"/g, '&quot;')
        .replace(/'/g, '&#039;');
}

function showReportModal(email, subject, body) {
    if (document.getElementById('reportModalOverlay')) return;

    const overlay = document.createElement('div');
    overlay.id = 'reportModalOverlay';
    overlay.style.cssText = 'position:fixed;inset:0;background:rgba(2,6,23,0.6);display:flex;align-items:center;justify-content:center;z-index:1000;padding:16px;';

    const modal = document.createElement('div');
    modal.style.cssText = 'width:100%;max-width:720px;background:linear-gradient(180deg, #0b1220, #0f1724);border-radius:12px;padding:18px;border:1px solid rgba(255,255,255,0.04);box-shadow:0 12px 48px rgba(2,6,23,0.7);color:var(--text-primary);font-family:inherit';

    const title = document.createElement('h3');
    title.textContent = 'Report an issue';
    title.style.margin = '0 0 8px 0';

    const desc = document.createElement('div');
    desc.style.cssText = 'color:var(--text-secondary);font-size:13px;margin-bottom:12px;';
    desc.textContent = 'Open your mail client or copy the prefilled report. If mail fails, use Copy and send manually.';

    const textarea = document.createElement('textarea');
    textarea.value = `To: ${email}\nSubject: ${subject}\n\n${body}`;
    textarea.style.cssText = 'width:100%;height:140px;border-radius:8px;padding:10px;background:rgba(255,255,255,0.02);color:var(--text-primary);border:1px solid rgba(255,255,255,0.04);resize:vertical;';

    const btnRow = document.createElement('div');
    btnRow.style.cssText = 'display:flex;gap:8px;justify-content:flex-end;margin-top:12px;';

    const openMailBtn = document.createElement('button');
    openMailBtn.textContent = 'Open mail client';
    openMailBtn.className = 'primary-button';
    openMailBtn.style.cssText = 'cursor:pointer;';
    openMailBtn.addEventListener('click', () => {
        const subjectEnc = encodeURIComponent(subject);
        const bodyEnc = encodeURIComponent(body);
        const mailtoHref = `mailto:${email}?subject=${subjectEnc}&body=${bodyEnc}`;
        const a = document.createElement('a');
        a.href = mailtoHref;
        a.target = '_blank';
        a.rel = 'noopener noreferrer';
        a.style.display = 'none';
        document.body.appendChild(a);
        a.click();
        a.remove();
    });

    const copyBtn = document.createElement('button');
    copyBtn.textContent = 'Copy report';
    copyBtn.className = 'secondary-button';
    copyBtn.addEventListener('click', async () => {
        try {
            await navigator.clipboard.writeText(textarea.value);
        } catch (e) {
            textarea.select();
            document.execCommand('copy');
        }
        showNotification('Report copied to clipboard');
    });

    const closeBtn = document.createElement('button');
    closeBtn.textContent = 'Close';
    closeBtn.className = 'secondary-button';
    closeBtn.addEventListener('click', () => overlay.remove());

    btnRow.appendChild(copyBtn);
    btnRow.appendChild(openMailBtn);
    btnRow.appendChild(closeBtn);

    modal.appendChild(title);
    modal.appendChild(desc);
    modal.appendChild(textarea);
    modal.appendChild(btnRow);
    overlay.appendChild(modal);
    document.body.appendChild(overlay);
}

function getUserById(id) {
    const users = getUsersCache();
    if (users && Array.isArray(users)) {
        const user = users.find(u => String(u.id) === String(id) || Number(u.id) === Number(id));
        if (user) return user;
    }
    return null;
}

function createInitialsAvatar(name) {
    const displayName = (name || 'Unknown').trim();
    const words = displayName.split(' ').filter(Boolean);

    let initials;
    if (words.length >= 2) {
        initials = (words[0][0] + words[1][0]).toUpperCase();
    } else if (words.length === 1) {
        initials = words[0].substring(0, 2).toUpperCase();
    } else {
        initials = 'U';
    }

    const colors = ['#667eea', '#764ba2', '#f093fb', '#4facfe', '#00f2fe', '#43e97b', '#fa709a'];
    const color = colors[Math.abs(displayName.charCodeAt(0) || 0) % colors.length];

    const svg = `<svg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 32 32'><rect fill='${color}' width='32' height='32'/><text x='50%' y='50%' dominant-baseline='central' text-anchor='middle' font-size='14' font-weight='bold' fill='white' font-family='sans-serif'>${initials}</text></svg>`;
    return `data:image/svg+xml,${encodeURIComponent(svg)}`;
}

function updateProfileImage(user) {
    const profileImage = document.getElementById('profileImage');
    const profileIcon = document.getElementById('profileIcon');
    if (!profileImage) return;
    const photo = user && user.photo ? user.photo : createInitialsAvatar(user && user.name);
    profileImage.src = photo;
    profileImage.onload = () => {
        profileImage.style.display = 'block';
        if (profileIcon) profileIcon.style.display = 'none';
    };
    profileImage.onerror = () => {
        const fallback = createInitialsAvatar(user && user.name);
        if (profileImage.src !== fallback) {
            profileImage.src = fallback;
        } else {
            profileImage.style.display = 'none';
            if (profileIcon) profileIcon.style.display = 'block';
        }
    };
}

function showNotification(message) {
    const hideEl = (el) => {
        if (!el) return;
        el.style.animation = 'slideDown 0.2s ease-in forwards';
        setTimeout(() => el.remove(), 200);
    };
    const existing = document.querySelectorAll('.appNotification');
    if (existing && existing.length) {
        existing.forEach(n => hideEl(n));
        setTimeout(() => showNotification(message), 0);
        return;
    }
    const notification = document.createElement('div');
    notification.className = 'appNotification';
    notification.textContent = message;
    setTimeout(() => hideEl(notification || null), 3000);
    notification.addEventListener('click', () => hideEl(notification));
    document.body.appendChild(notification);
}

async function sendLikeToServer(codeId) {
    const token = getToken();
    const headers = { 'Content-Type': 'application/json' };
    if (token) headers['Authorization'] = `Bearer ${token}`;

    const res = await fetch(`/api/codes/${codeId}/like`, {
        method: 'POST',
        headers
    });

    if (!res.ok) {
        const body = await res.json().catch(() => ({}));
        throw new Error(body.error || 'Failed to like code');
    }

    return res.json();
}

function initializeCodeTab() {
    document.querySelector('#code').querySelectorAll('.filterBtn').forEach(b => b.addEventListener('click', () => displayCodes(b.getAttribute('data-filter'))));
    const createCodeBtn = document.getElementById('createCodeBtn');
    if (createCodeBtn) {
        createCodeBtn.addEventListener('click', () => openCodeEditor());
    }

    const publishBtn = document.getElementById('editorPublishBtn');
    const discardBtn = document.getElementById('editorDiscardBtn');
    if (publishBtn) publishBtn.addEventListener('click', publishCode);
    if (discardBtn) discardBtn.addEventListener('click', discardCode);
}

function getAllCodes() {
    const cached = getUsersCache();
    if (!cached || !Array.isArray(cached)) return [];

    const allCodes = [];
    cached.forEach(user => {
        if (user.codes && Array.isArray(user.codes)) {
            user.codes.forEach(code => {
                allCodes.push({
                    ...code,
                    userid: user.id
                });
            });
        }
    });
    return allCodes;
}

function filterCodes(filterType) {
    let codes = getAllCodes();

    const getLikes = (c) => Array.isArray(c && c.likedBy) ? c.likedBy.length : 0;

    switch (filterType) {
        case 'trending':
            codes = codes.sort((a, b) => {
                const viewsDiff = (b.views || 0) - (a.views || 0);
                if (viewsDiff !== 0) return viewsDiff;
                const likesDiff = getLikes(b) - getLikes(a);
                if (likesDiff !== 0) return likesDiff;
                return new Date(b.updatedAt) - new Date(a.updatedAt);
            });
            break;
        case 'myCode':
            const currentUser = getAuthStoredUser();
            if (!currentUser || !currentUser.id) return [];
            codes = codes.filter(c => c.userid === currentUser.id).sort((a, b) => new Date(b.updatedAt) - new Date(a.updatedAt));
            break;
        case 'recent':
            codes = codes.sort((a, b) => new Date(b.updatedAt) - new Date(a.updatedAt));
            break;
        case 'mostLiked':
            codes = codes.sort((a, b) => getLikes(b) - getLikes(a));
            break;
        default:
            codes = codes.sort((a, b) => new Date(b.updatedAt) - new Date(a.updatedAt));
    }
    return codes;
}

function displayCodes(filterType) {
    document.querySelector('#code').querySelectorAll('.filterBtn').forEach(b => b.classList.remove('active'));
    document.querySelector(`#code .filterBtn[data-filter="${filterType}"]`).classList.add('active');

    const container = document.getElementById('codeContent');
    const codes = filterCodes(filterType);
    if (!codes || codes.length === 0) {
        container.innerHTML = `
            <div style="grid-column: 1 / -1; text-align: center; padding: 40px 20px; color: var(--text-secondary);">
                <i class="fas fa-inbox" style="font-size: 48px; margin-bottom: 12px; opacity: 0.5;"></i>
                <p style="margin: 0;">No codes found in this category</p>
            </div>
        `;
        return;
    }
    container.innerHTML = codes.map(code => buildCodeCard(code)).join('');
    container.querySelectorAll('[data-code-id]').forEach(card => {
        card.addEventListener('click', (e) => {
            if (!e.target.closest('button')) {
                const codeId = card.getAttribute('data-code-id');
                const code = getAllCodes().find(c => String(c.id) === String(codeId));
                if (code) showCodeDetail(code);
                else showNotification('Code not found');
            }
        });
    });
    container.querySelectorAll('.likeCodeBtn').forEach(btn => {
        btn.addEventListener('click', async (e) => {
            e.stopPropagation();

            if (typeof AuthService === 'undefined' || !AuthService.isAuthenticated()) {
                showNotification('Please sign in to like code');
                return;
            }

            const codeId = btn.getAttribute('data-code-id');
            if (!codeId) return;

            btn.disabled = true;
            const likesText = btn.querySelector('.likesText');
            const currentLikes = parseInt(likesText?.textContent || '0', 10) || 0;
            const currentlyLiked = btn.getAttribute('data-liked') === 'true';

            const optimisticLikes = currentlyLiked ? Math.max(0, currentLikes - 1) : currentLikes + 1;
            if (likesText) likesText.textContent = optimisticLikes;
            btn.setAttribute('data-liked', (!currentlyLiked).toString());
            btn.classList.toggle('liked');

            try {
                const result = await sendLikeToServer(codeId);
                if (result && result.code) {
                    if (typeof result.code.likedBy !== 'undefined') {
                        if (likesText) likesText.textContent = String(result.code.likedBy.length || 0);
                    }
                    try {
                        const ownerId = result.code.userid || null;
                        if (ownerId && Array.isArray(AppState.users)) {
                            const owner = AppState.users.find(u => String(u.id) === String(ownerId));
                            if (owner) {
                                const cid = result.code.id || null;
                                if (cid !== null) {
                                    const idx = owner.codes.findIndex(c => String(c.id) === String(cid));
                                    if (idx !== -1) {
                                        owner.codes[idx] = { ...owner.codes[idx], ...result.code };
                                    }
                                }
                                if (String(AppState.currentUser?.id) === String(ownerId)) {
                                    AppState.currentUser = { ...AppState.currentUser, ...owner };
                                }
                            }
                        }
                    } catch (e) {
                        console.warn('Failed to update local code cache,', e.message);
                    }
                }
                if (typeof result.liked !== 'undefined') {
                    btn.setAttribute('data-liked', result.liked ? 'true' : 'false');
                    if (result.liked) btn.classList.add('liked'); else btn.classList.remove('liked');
                }
            } catch (err) {
                if (likesText) likesText.textContent = currentLikes;
                btn.setAttribute('data-liked', currentlyLiked ? 'true' : 'false');
                if (currentlyLiked) btn.classList.add('liked'); else btn.classList.remove('liked');
                showNotification(err.message || 'Failed to send like');
            } finally {
                btn.disabled = false;
            }
        });
    });
    container.querySelectorAll('.editCodeBtn').forEach(btn => {
        btn.addEventListener('click', (e) => {
            e.stopPropagation();
            const codeId = btn.getAttribute('data-code-id');
            const code = getAllCodes().find(c => String(c.id) === String(codeId));
            if (code) openCodeEditor(code);
        });
    });
    container.querySelectorAll('.deleteCodeBtn').forEach(btn => {
        btn.addEventListener('click', (e) => {
            e.stopPropagation();
            if (confirm('Are you sure you want to delete this code?')) {
                const codeId = btn.getAttribute('data-code-id');
                deleteCodeOnServer(codeId);
            }
        });
    });
}

function buildCodeCard(code) {
    const currentUser = getAuthStoredUser();
    const isMyCode = currentUser && currentUser.id && code.userid === currentUser.id;
    const isLiked = Array.isArray(code.likedBy) && currentUser && currentUser.id && code.likedBy.some(id => String(id) === String(currentUser.id));
    const user = getUserById(code.userid);
    if (!user) return '';
    return `
        <div class="codeCard" data-code-id="${code.id}" style="cursor: pointer;">
            <div class="codeCardHeader">
                <div style="display: flex; align-items: center; gap: 10px;">
                    ${createUserAvatar(user.photo, user.name, `class="codeAuthorAvatar"`)}
                    <div>
                        <p style="margin: 0; font-weight: 600; color: var(--text-primary);">${escapeHtml(user.name)}</p>
                        <p style="margin: 2px 0 0 0; font-size: 12px; color: var(--text-secondary);">${new Date(code.updatedAt).toLocaleString()}</p>
                    </div>
                </div>
                <span class="codeBadge">${escapeHtml(code.language)}</span>
            </div>
            <h3 class="codeCardTitle">${escapeHtml(code.title)}</h3>
            <p class="codeCardDescription">${escapeHtml(code.description)}</p>
            <div class="codeCardFooter">
                <div style="display: flex; gap: 16px; flex: 1;">
                    <span><i class="fas fa-eye"></i> ${code.views}</span>
                    <button class="likeCodeBtn ${isLiked ? 'liked' : ''}" data-code-id="${code.id}" data-liked="${isLiked ? 'true' : 'false'}">
                        <i class="fas fa-heart"></i><div class="likesText">${Array.isArray(code.likedBy) ? code.likedBy.length : 0}</div>
                    </button>
                </div>
                ${isMyCode ? `<div style="display: flex; gap: 6px;">
                    <button class="editCodeBtn primary-button" data-code-id="${code.id}" style="padding: 6px 12px; font-size: 12px;"><i class="fas fa-edit"></i> Edit</button>
                    <button class="deleteCodeBtn secondary-button" data-code-id="${code.id}" style="padding: 8px 10px; font-size: 12px; border-color: var(--danger); color: var(--danger);"><i class="fas fa-trash"></i></button>
                </div>` : ''}
            </div>
        </div>
    `;
}

async function showCodeDetail(code) {
    const user = getUserById(code.userid);
    if (!user) return;
    const prevCard = document.querySelector('#codeDetailModal');
    if (prevCard) prevCard.remove();
    const modal = document.createElement('div');
    modal.id = 'codeDetailModal';
    modal.style.cssText = 'position:fixed;inset:0;background:rgba(2,6,23,0.8);display:flex;align-items:center;justify-content:center;z-index:100;padding:16px;';

    const content = document.createElement('div');
    content.style.cssText = 'display:flex;flex-direction:column;width:100%;max-width:800px;max-height:90%;overflow-y:auto;background:linear-gradient(180deg, #0b1220, #0f1724);border-radius:16px;padding:10px 20px;border:1px solid rgba(255,255,255,0.04);box-shadow:0 12px 48px rgba(2,6,23,0.7);color:var(--text-primary);font-family:inherit;';

    content.innerHTML = `
        <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 20px;">
                <button class="code-close secondary-button" style="padding: 8px 10px;">✕</button>
                <h3 style="line-height: 1; flex:1; margin: 10px; color: var(--text-primary);">${escapeHtml(code.title.trim())}</h3>
                <span class="codeBadge" style="display: inline-block;">${escapeHtml(code.language.trim())}</span>
        </div>
        
        <div style="display: flex; align-items: center; gap: 12px; margin-bottom: 20px; padding-bottom: 20px; border-bottom: 1px solid rgba(255,255,255,0.1);">
            ${createUserAvatar(user.photo, user.name, `style="width: 32px; height: 32px; border-radius: 50%; object-fit: cover;"`)}
            <div style="flex: 1;">
                <p style="margin: 0; font-weight: 600;">${escapeHtml(user.name)}</p>
                <p style="margin: 2px 0 0 0; font-size: 12px; color: var(--text-secondary);">${new Date(code.updatedAt).toLocaleString()}</p>
            </div>
            <div style="display: flex; gap: 12px;">
                <div style="text-align: center;">
                    <p class="viewsCount" style="margin: 0; font-size: 18px; font-weight: 600;">${(code.views + 1) || 1}</p>
                    <p style="margin: 4px 0 0 0; font-size: 12px; color: var(--text-secondary);">Views</p>
                </div>
                <div style="text-align: center;">
                    <p style="margin: 0; font-size: 18px; font-weight: 600;">${Array.isArray(code.likedBy) ? code.likedBy.length : 0}</p>
                    <p style="margin: 4px 0 0 0; font-size: 12px; color: var(--text-secondary);">Likes</p>
                </div>
            </div>
        </div>
        
        <p style="color: var(--text-secondary); margin-bottom: 16px;">${escapeHtml(code.description) || 'No description provided'}</p>
        
        <div style="flex:1;min-height: 100px; overflow: auto; background: rgba(99, 102, 241, 0.08); border-radius: 12px; padding: 16px; border: 1px solid rgba(99, 102, 241, 0.2);">
            <pre style="margin: 0; color: var(--text-primary); font-family: 'Monaco', 'Menlo', monospace; font-size: 12px;"><code>${escapeHtml(code.code)}</code></pre>
        </div>`;
    modal.appendChild(content);
    document.body.appendChild(modal);
    const closeBtn = content.querySelector('.code-close');
    if (closeBtn) closeBtn.addEventListener('click', () => modal.remove());

    try {
        const res = await fetch(`/api/codes/${code.id}/view`, {
            method: 'POST',
            headers: { 'Authorization': `Bearer ${getToken()}`, 'Content-Type': 'application/json' }
        });
        if (res.ok) {
            const data = await res.json();
            if (data && data.success) {
                code.views = data.views;
                const viewsCountEl = content.querySelector('.viewsCount');
                if (viewsCountEl) viewsCountEl.textContent = String(data.views || 0);
                const ownerId = code.userid;
                if (ownerId && Array.isArray(AppState.users)) {
                    const owner = AppState.users.find(u => String(u.id) === String(ownerId));
                    if (owner && owner.codes) {
                        const cidx = owner.codes.findIndex(c => String(c.id) === String(code.id));
                        if (cidx !== -1) {
                            owner.codes[cidx].views = data.views;
                        }
                    }
                }
            }
        }
    } catch (e) {
        if (e && isDebug) console.warn('Failed to increment views:', e.message);
    }
}

function openCodeEditor(codeToEdit = null) {
    AppState.currentEditingCode = codeToEdit;
    changeScreen('codeEditor');

    document.getElementById('editorTitle').value = (codeToEdit && codeToEdit.title) ? codeToEdit.title : '';
    document.getElementById('editorLanguage').value = (codeToEdit && codeToEdit.language) ? codeToEdit.language : 'SelectLanguage';
    document.getElementById('editorDescription').value = (codeToEdit && codeToEdit.description) ? codeToEdit.description : '';
    document.getElementById('editorContent').value = (codeToEdit && codeToEdit.code) ? codeToEdit.code : '';

    const publishBtn = document.getElementById('editorPublishBtn');
    if (publishBtn) {
        publishBtn.innerHTML = codeToEdit
            ? '<i class="fas fa-save"></i> Save Changes'
            : '<i class="fas fa-cloud-arrow-up"></i> Publish Code';
        publishBtn.disabled = false;
        publishBtn.style.opacity = '1';
    }
    document.getElementById('editorTitle').focus();
}

async function publishCode() {
    const title = document.getElementById('editorTitle').value.trim();
    const language = document.getElementById('editorLanguage').value;
    const description = document.getElementById('editorDescription').value.trim();
    const code = document.getElementById('editorContent').value.trim();

    if (!title) {
        showNotification('❌ Title is required');
        return;
    }
    if (!code) {
        showNotification('❌ Code content is required');
        return;
    }
    if (code.length < 10) {
        showNotification('❌ Code must be at least 10 characters');
        return;
    }

    const publishBtn = document.getElementById('editorPublishBtn');
    if (publishBtn) {
        publishBtn.disabled = true;
        publishBtn.style.opacity = '0.7';
        publishBtn.innerHTML = '<i class="fas fa-spinner fa-spin"></i> Publishing...';
    }

    const editing = AppState.currentEditingCode;
    const editingId = editing && (editing.id || editing.ID || editing.codeId) ? (editing.id || editing.ID || editing.codeId) : null;
    if (editing && editingId) {
        const codeId = Number(editingId);
        if (!isFinite(codeId)) {
            console.warn('Invalid codeId detected, falling back to create');
            await createCodeOnServer(title, language, description, code, publishBtn);
            return;
        }
        await updateCodeOnServer(codeId, title, language, description, code, publishBtn);
    } else {
        await createCodeOnServer(title, language, description, code, publishBtn);
    }
}

async function createCodeOnServer(title, language, description, code, publishBtn) {
    try {
        const response = await fetch('/api/codes', {
            method: 'POST', headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${getToken()}` },
            body: JSON.stringify({ title, language, description, code })
        });

        if (!response.ok) {
            const error = await response.json();
            throw new Error(error.error || 'Failed to publish code');
        }

        const newCode = await response.json();
        showNotification('✅ Code published successfully!');
        AppState.currentEditingCode = null;
        await updateUsers();
        displayCodes('myCode');
        changeScreen('code');
    } catch (err) {
        console.error('createCodeOnServer error:', err.message);
        showNotification(`❌ Error: ${err.message}`);
        if (publishBtn) {
            publishBtn.disabled = false;
            publishBtn.style.opacity = '1';
            publishBtn.innerHTML = '<i class="fas fa-paper-plane"></i> Publish Code';
        }
    }
}

async function updateCodeOnServer(codeId, title, language, description, code, publishBtn) {
    try {
        const response = await fetch(`/api/codes/${codeId}`, {
            method: 'PUT', headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${getToken()}` },
            body: JSON.stringify({ title, language, description, code })
        });

        if (!response.ok) {
            const error = await response.json();
            throw new Error(error.error || 'Failed to update code');
        }

        const updatedCode = await response.json();
        showNotification('✅ Code updated successfully!');
        AppState.currentEditingCode = null;
        await updateUsers();
        displayCodes('myCode');
        changeScreen('code');
    } catch (err) {
        console.error('updateCodeOnServer error:', err.message);
        showNotification(`❌ Error: ${err.message}`);
        if (publishBtn) {
            publishBtn.disabled = false;
            publishBtn.style.opacity = '1';
            publishBtn.innerHTML = '<i class="fas fa-save"></i> Save Changes';
        }
    }
}

async function deleteCodeOnServer(codeId) {
    try {
        const response = await fetch(`/api/codes/${codeId}`, {
            method: 'DELETE', headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${getToken()}` }
        });

        if (!response.ok) {
            const error = await response.json();
            throw new Error(error.error || 'Failed to delete code');
        }
        showNotification('✅ Code deleted successfully!');
        await updateUsers();
        const currentFilter = document.querySelector('#code .filterBtn.active')?.getAttribute('data-filter') || 'trending';
        displayCodes(currentFilter);
    } catch (err) {
        console.error('deleteCodeOnServer error:', err.message);
        showNotification(`❌ Error: ${err.message}`);
    }
}

function discardCode() {
    const fields = [
        { el: document.getElementById('editorTitle'), key: 'title' },
        { el: document.getElementById('editorLanguage'), key: 'language' },
        { el: document.getElementById('editorDescription'), key: 'description' },
        { el: document.getElementById('editorContent'), key: 'code' }
    ];
    const currCode = AppState.currentEditingCode;
    const hasChanges = fields.some(({ el, key }) => {
        const origValue = el.value.trim();
        if (currCode) {
            const currValue = currCode[key];
            return currValue && currValue !== origValue;
        } else {
            if (key === 'language') return origValue !== 'SelectLanguage';
            return origValue !== '';
        }
    });
    if (hasChanges && !confirm('Are you sure you want to discard your changes?')) return;
    AppState.currentEditingCode = null;
    fields.forEach(({ el }) => el.value = '');
    changeScreen('code');
}

if (!(typeof navigator === 'undefined' || navigator.userAgent.includes('wv'))) {
    console.log('%cSoloLearn 2.0', 'font-size: 24px; color: #6366f1; font-weight: bold;');
    console.log('%cWelcome to the revolutionary coding platform!', 'font-size: 14px; color: #ec4899;');
    console.log('%cVersion 2.0.0 | Built with ❤️', 'color: #06b6d4;');
}
