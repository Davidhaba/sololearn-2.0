const AppState = {
    currentScreen: 'main',
    userid: 0,
    users: null,
    notifications: [],
    lives: 5,
    token: AuthService.getToken() || null,
    currentEditingCode: null
};

async function fetchUsersFromApi() {
    try {
        const response = await fetch('/api/users', {
            method: 'GET', headers: { 'Authorization': `Bearer ${AppState.token}`, 'Content-Type': 'application/json' }
        });

        if (!response.ok) throw new Error(response.status);
        const data = await response.json();
        return Array.isArray(data) ? data : null;
    } catch (err) {
        throw new Error(err.message);
    }
}

async function initApp() {
    const currentUser = await AuthService.getCurrentUser();
    if (currentUser) {
        AppState.userid = currentUser.id || 0;
        AppState.currentUser = currentUser;
        updateProfileImage(currentUser);
    }
    await updateUsers();
    initializeEventListeners();
    initializeCodeTab();
    displayUserData();
    changeScreen('main');
}

if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', initApp);
} else {
    initApp();
}

function initializeEventListeners() {
    document.querySelectorAll('[data-open-screen]').forEach(button => {
        button.addEventListener('click', (e) => {
            const screenId = button.getAttribute('data-open-screen');
            changeScreen(screenId);
            if (screenId === 'userProfile') {
                loadProfileById(AppState.userid);
                const currentUser = AppState.currentUser || AuthService.getStoredUser();
                if (currentUser) {
                    updateProfileImage(currentUser);
                }
            }
            else if (screenId === 'leaders') loadLeaderboard();
            else if (screenId === 'code') displayCodes('trending');
        });
    });

    document.getElementById('favBtn').addEventListener('click', () => {
        showNotification(`❤️ You have ${AppState.lives || 0} lives!`);
    });

    document.getElementById('streakBtn').addEventListener('click', () => {
        const currentUser = getUserById(AppState.userid);
        if (currentUser) {
            showNotification(`🔥 Your current streak: ${currentUser.streak || 0} days!`);
            document.getElementById('streakCount').textContent = currentUser.streak || 0;
        }
    });

    document.getElementById('notifBtn').addEventListener('click', () => {
        showNotification((AppState.notifications.length >= 1) ? `📢 You have ${AppState.notifications.length || 0} new notifications!` : "You have no new notifications.");
    });

    document.getElementById('menuBtn').addEventListener('click', () => {
        toggleSideMenu();
    });

    const closeBtn = document.getElementById('closeSideMenu');
    if (closeBtn) closeBtn.addEventListener('click', closeSideMenu);
    const menuOverlay = document.getElementById('sideMenuOverlay');
    if (menuOverlay) menuOverlay.addEventListener('click', (e) => {
        if (e.target === menuOverlay) closeSideMenu();
    });
    const logoutBtn = document.getElementById('menuLogoutBtn');
    if (logoutBtn) logoutBtn.addEventListener('click', () => {
        closeSideMenu();
        handleLogout();
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
            loadProfileById(AppState.userid);
            closeSideMenu();
        });
        sideProfile.addEventListener('keydown', (e) => {
            if (e.key === 'Enter' || e.key === ' ') {
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

function openProfileEditor() {
    const user = AppState.currentUser || AuthService.getStoredUser();
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
    if (!AppState.token) {
        btn.disabled = false;
        showNotification('You are not authenticated.');
        return;
    }

    try {
        const res = await fetch('/auth/me', {
            method: 'PUT', headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${AppState.token}` },
            body: JSON.stringify({ name, photo })
        });
        const data = await res.json();
        btn.disabled = false;
        if (!res.ok) throw new Error(data.error || `Status ${res.status}`);

        AppState.currentUser = data;
        updateProfileImage(data);
        const sideName = document.getElementById('sideMenuName');
        if (sideName) sideName.textContent = data.name || 'User';
        const sideAvatar = document.getElementById('sideMenuAvatar');
        if (sideAvatar) sideAvatar.src = data.photo || createInitialsAvatar(data.name);

        try { await updateUsers(); } catch (e) { }

        showNotification('Profile updated');
        changeScreen('userProfile');
        showUserProfile(data);
    } catch (err) {
        btn.disabled = false;
        console.error('Failed to save profile:', err);
        showNotification('Failed to update profile');
    }
}

function cancelProfileEdit() {
    changeScreen('userProfile');
    const current = AppState.currentUser || AuthService.getStoredUser();
    if (current) showUserProfile(current);
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
    const avatar = document.getElementById('sideMenuAvatar');
    const nameEl = document.getElementById('sideMenuName');
    const user = AppState.currentUser || AuthService.getStoredUser();
    if (nameEl && user && user.name) nameEl.textContent = user.name;
    if (avatar && user) {
        avatar.outerHTML = createUserAvatar(user.photo, user.name, avatar.attributes);
    }
    if (overlay) overlay.style.display = 'block';
}

function closeSideMenu() {
    const overlay = document.getElementById('sideMenuOverlay');
    if (overlay) overlay.style.display = 'none';
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

    const titles = {
        'main': 'Home',
        'leaders': 'Leaderboard',
        'code': 'Code',
        'userProfile': 'Profile',
        'codeEditor': 'Code Editor',
        'profileEditor': 'Profile Editor'
    };
    document.getElementById('droptopTitle').textContent = titles[screenId] || screenId;
}

async function updateUsers() {
    try {
        const onlineUsers = await fetchUsersFromApi();
        if (Array.isArray(onlineUsers) && onlineUsers.length) {
            AppState.users = onlineUsers;
            return;
        }
    } catch (err) {
        console.warn('Failed to load users from API:', err.message);
    }
}

async function loadProfileById(id) {
    const userScreen = document.getElementById('userProfile');
    userScreen.innerHTML = `<div style="color:var(--text-secondary)"><i class="fas fa-spinner fa-spin"></i> Loading profile...</div>`;

    const showFallback = () => {
        userScreen.innerHTML = `<div style="color:var(--text-secondary)">Error loading profile</div>`;
    };
    try {
        const currentUser = AppState.currentUser || await AuthService.getCurrentUser();
        if (currentUser) {
            showUserProfile(currentUser);
        } else {
            throw new Error('User not authenticated');
        }
    } catch (err) {
        showFallback();
        console.warn('Failed to load user:', err.message);
    };
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

function showUserProfile(user = null) {
    if (!user) return;
    const userScreen = document.getElementById('userProfile');
    const isCurrent = (AppState.userid && user.id && String(user.id) === String(AppState.userid));
    user = {
        name: user.name || 'Unknown',
        level: Number(user.level) || 0,
        xp: Number(user.xp) || 0,
        streak: user.streak || 0,
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

async function loadLeaderboard() {
    const leaderboardContent = document.getElementById('leaderboardContent');
    leaderboardContent.innerHTML = `
        <div style="display:flex;align-items:center;gap:12px;color:var(--text-secondary);">
            <div style="width:18px;height:18px;border-radius:50%;border:3px solid rgba(255,255,255,0.08);border-top-color:var(--primary);animation:spin 0.9s linear infinite"></div>
            <div>Loading leaderboard...</div>
        </div>
    `;
    try {
        await updateUsers();
        const users = getUsersCache();
        if (users && Array.isArray(users)) {
            renderLeaderboard(users, leaderboardContent);
            return;
        }
    } catch (err) {
        const msg = err.name === 'AbortError' ? 'Request timed out.' : err.message || 'Unknown error.';
        console.warn(`Users fetch failed:`, msg);
    };
    showLeaderboardMessage(leaderboardContent, "Unable to load leaderboard");
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
        if (it.id && it.id === AppState.userid) {
            if (!it.name) it.name = 'You';
        }
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
                showUserProfile(target);
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
    return `
        <div style="display: flex; align-items: center; gap: 12px; padding: 14px; background: linear-gradient(135deg, rgba(99, 102, 241, 0.08), rgba(236, 72, 153, 0.05)); border-radius: 12px; margin-bottom: 10px; border: 1px solid rgba(148, 163, 184, 0.1); transition: all 0.3s;">
            <div style="font-size: 20px; width: 30px; text-align: center;">${user.badge || '•'}</div>
            <div style="width:36px;height:36px;flex:0 0 36px;border-radius:8px;overflow:hidden;">
                ${createUserAvatar(user.photo, user.name, `data-profile-idx="${idx}" style="width:100%;height:100%;object-fit:cover;display:block;"`)}
            </div>
            <div style="flex: 1;">
                <p style="margin: 0; font-weight: 600; color: var(--text-primary);">
                    <a data-profile-idx="${idx}">${escapeHtml(user.name + (user.id === AppState.userid ? ' (You)' : ''))}</a>
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
    const el = document.createElement('div');
    el.style.cssText = 'padding:14px;text-align:center;color:var(--text-secondary);';
    el.innerHTML = `<div style="margin-bottom:8px;">${escapeHtml(message)}</div>`;

    const retry = document.createElement('button');
    retry.textContent = 'Retry';
    retry.className = 'primary-button';
    retry.style.cssText = 'margin-right:8px;';
    retry.addEventListener('click', () => {
        loadLeaderboard();
    });
    const report = document.createElement('button');
    report.textContent = 'Report';
    report.className = 'secondary-button';
    report.addEventListener('click', () => {
        const subject = 'Leaderboard load error';
        const body = `I could not load the leaderboard on ${location.href} at ${new Date().toLocaleString()}.
\n\nPlease include any steps to reproduce and your browser/OS.`;
        showReportModal('samsung22vs23@gmail.com', subject, body);
    });
    const wrapper = document.createElement('div');
    wrapper.style.marginTop = '8px';
    wrapper.appendChild(retry);
    wrapper.appendChild(report);
    el.appendChild(wrapper);

    container.innerHTML = '';
    container.appendChild(el);
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
    openMailBtn.style.cssText = 'padding:8px 12px;border-radius:8px;border:0;background:var(--primary);color:white;cursor:pointer;';
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
    copyBtn.style.cssText = 'padding:8px 12px;border-radius:8px;border:1px solid rgba(255,255,255,0.06);background:transparent;color:var(--text-primary);cursor:pointer;';
    copyBtn.addEventListener('click', async () => {
        try {
            await navigator.clipboard.writeText(textarea.value);
        } catch (e) {
            textarea.select();
            document.execCommand('copy');
        }
    });

    const closeBtn = document.createElement('button');
    closeBtn.textContent = 'Close';
    closeBtn.style.cssText = 'padding:8px 12px;border-radius:8px;border:1px solid rgba(255,255,255,0.06);background:transparent;color:var(--text-secondary);cursor:pointer;';
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
        const user = users.find(u => Number(u.id) === Number(id) || String(u.id) === String(id));
        if (user) return user;
    }
    return null;
}

function createInitialsAvatar(name) {
    const displayName = (name || 'User').trim();
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


function displayUserData() {
    const currentUser = AppState.currentUser || AuthService.getStoredUser();
    if (currentUser) {
        const streakEl = document.getElementById('streakCount');
        if (streakEl) streakEl.textContent = currentUser.streak || 0;
        const livesEl = document.getElementById('livesCount');
        if (livesEl) livesEl.textContent = currentUser.lives || AppState.lives || 5;
    } else {
        const livesEl = document.getElementById('livesCount');
        if (livesEl) livesEl.textContent = AppState.lives || 0;
    }

    const notifEl = document.getElementById('notifCount');
    if (notifEl) {
        if (AppState.notifications.length >= 1) notifEl.textContent = AppState.notifications.length || 0;
        else notifEl.style.display = 'none';
    }
}

function showNotification(message) {
    const hideEl = (el) => {
        el.style.animation = 'slideDown 0.2s ease-in forwards';
        setTimeout(() => el.remove(), 200);
    };
    const existing = document.querySelectorAll('.appNotification');
    if (existing && existing.length) {
        setTimeout(() => showNotification(message), 0);
        existing.forEach(n => hideEl(n));
        return;
    }
    const notification = document.createElement('div');
    notification.className = 'appNotification';
    notification.style.cssText = `
        position: absolute;
        bottom: 80px;
        left: 50%;
        transform: translateX(-50%);
        background: linear-gradient(135deg, var(--primary), var(--secondary));
        color: white;
        padding: 14px 24px;
        border-radius: 12px;
        font-weight: 600;
        z-index: 1000;
        animation: slideUp 0.4s cubic-bezier(0.34, 1.56, 0.64, 1);
        box-shadow: 0 12px 32px rgba(99, 102, 241, 0.3);
        max-width: 90%;
        text-align: center;
    `;
    notification.textContent = message;
    setTimeout(() => hideEl(notification), 3000);
    notification.addEventListener('click', () => hideEl(notification));
    document.body.appendChild(notification);
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

    switch (filterType) {
        case 'trending':
            codes = codes.sort((a, b) => {
                const viewsDiff = (b.views || 0) - (a.views || 0);
                if (viewsDiff !== 0) return viewsDiff;
                const likesDiff = (b.likes || 0) - (a.likes || 0);
                if (likesDiff !== 0) return likesDiff;
                return new Date(b.timestamp) - new Date(a.timestamp);
            });
            break;
        case 'myCode':
            codes = codes.filter(c => c.userid === AppState.userid).sort((a, b) => new Date(b.timestamp) - new Date(a.timestamp));
            break;
        case 'recent':
            codes = codes.sort((a, b) => new Date(b.timestamp) - new Date(a.timestamp));
            break;
        case 'mostLiked':
            codes = codes.sort((a, b) => b.likes - a.likes);
            break;
        default:
            codes = codes.sort((a, b) => new Date(b.timestamp) - new Date(a.timestamp));
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
                const code = codes.find(c => c.id === parseInt(codeId));
                if (code) showCodeDetail(code);
            }
        });
    });
    container.querySelectorAll('.likeCodeBtn').forEach(btn => {
        btn.addEventListener('click', (e) => {
            e.stopPropagation();
            btn.classList.toggle('liked');
        });
    });
    container.querySelectorAll('.editCodeBtn').forEach(btn => {
        btn.addEventListener('click', (e) => {
            e.stopPropagation();
            const codeId = btn.getAttribute('data-code-id');
            const code = codes.find(c => c.id === parseInt(codeId));
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
    const isMyCode = code.userid === AppState.userid;
    const user = getUserById(code.userid);
    if (!user) return '';
    return `
        <div class="codeCard" data-code-id="${code.id}" style="cursor: pointer;">
            <div class="codeCardHeader">
                <div style="display: flex; align-items: center; gap: 10px;">
                    ${createUserAvatar(user.photo, user.name, `class="codeAuthorAvatar"`)}
                    <div>
                        <p style="margin: 0; font-weight: 600; color: var(--text-primary);">${escapeHtml(user.name)}</p>
                        <p style="margin: 2px 0 0 0; font-size: 12px; color: var(--text-secondary);">${code.timestamp}</p>
                    </div>
                </div>
                <span class="codeBadge">${escapeHtml(code.language)}</span>
            </div>
            <h3 class="codeCardTitle">${escapeHtml(code.title)}</h3>
            <p class="codeCardDescription">${escapeHtml(code.description)}</p>
            <div class="codeCardFooter">
                <div style="display: flex; gap: 16px; flex: 1;">
                    <span><i class="fas fa-eye"></i> ${code.views}</span>
                    <button class="likeCodeBtn" style="display: flex; align-items: center; gap: 4px; background: none; border: none; color: var(--text-secondary); cursor: pointer; transition: all 0.3s;">
                        <i class="fas fa-heart"></i> ${code.likes}
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

function showCodeDetail(code) {
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
                <p class="code-timestamp" style="margin: 2px 0 0 0; font-size: 12px; color: var(--text-secondary);">${code.timestamp}</p>
            </div>
            <div style="display: flex; gap: 12px;">
                <div style="text-align: center;">
                    <p style="margin: 0; font-size: 18px; font-weight: 600;">${code.views}</p>
                    <p style="margin: 4px 0 0 0; font-size: 12px; color: var(--text-secondary);">Views</p>
                </div>
                <div style="text-align: center;">
                    <p style="margin: 0; font-size: 18px; font-weight: 600;">${code.likes}</p>
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
}

function openCodeEditor(codeToEdit = null) {
    AppState.currentEditingCode = codeToEdit;

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
    changeScreen('codeEditor');
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
            method: 'POST', headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${AppState.token}` },
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
            method: 'PUT', headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${AppState.token}` },
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
            method: 'DELETE', headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${AppState.token}` }
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
    const title = document.getElementById('editorTitle').value.trim();
    const code = document.getElementById('editorContent').value.trim();
    if (title || code) {
        if (!confirm('Are you sure you want to discard your changes?')) {
            return;
        }
    }
    AppState.currentEditingCode = null;
    document.getElementById('editorTitle').value = '';
    document.getElementById('editorLanguage').value = '';
    document.getElementById('editorDescription').value = '';
    document.getElementById('editorContent').value = '';
    changeScreen('code');
}

if (!(typeof navigator === 'undefined' || navigator.userAgent.includes('wv'))) {
    console.log('%cSoloLearn 2.0', 'font-size: 24px; color: #6366f1; font-weight: bold;');
    console.log('%cWelcome to the revolutionary coding platform!', 'font-size: 14px; color: #ec4899;');
    console.log('%cVersion 2.0.0 | Built with ❤️', 'color: #06b6d4;');
}
