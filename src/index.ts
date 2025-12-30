require('dotenv').config();
const express = require('express');
const cors = require('cors');
const admin = require('firebase-admin');
const path = require('path');
const fs = require('fs');
const { hashPassword, verifyPassword, createToken, authMiddleware } = require('./auth-service');

import { Request, Response, NextFunction } from 'express';

declare global {
    namespace Express {
        interface Request {
            user?: { userId: string; email: string };
        }
    }
}

interface Code {
    id: number;
    userid: string;
    title: string;
    language: string;
    description: string;
    files: { name: string; content: string }[];
    views: number;
    likedBy: string[];
    isPublic: boolean;
    createdAt: string;
    updatedAt: string;
}

interface User {
    id?: string;
    name: string;
    level: number;
    xp: number;
    streak: number;
    achievements: string[];
    photo: string;
    codes: Code[];
    createdAt: string;
    updatedAt: string;
}

const app = express();
app.use(cors());
app.use(express.json());

const serviceAccount = JSON.parse(process.env.FIREKEY_JSON || '{}');
admin.initializeApp({
    credential: admin.credential.cert(serviceAccount),
    projectId: serviceAccount.project_id
});
const db = admin.firestore();

async function getUsers(userId: string) {
    const snapshot = await db.collection('users').get();
    const users = snapshot.docs.map((doc: any) => {
        const data = { id: doc.id, ...doc.data() };
        if (data.codes && Array.isArray(data.codes)) {
            data.codes = data.codes.filter((code: Code) => code.isPublic || code.userid === userId);
        }
        return data;
    });
    return users;
}

async function getUser(userId: string): Promise<User | null> {
    const doc = await db.collection('users').doc(userId).get();
    return doc.exists ? { id: doc.id, ...doc.data() } as User : null;
}

async function updateUser(userId: string, updates: Partial<User>, updateTimestamp: boolean = true) {
    if (updateTimestamp) {
        updates.updatedAt = new Date().toISOString();
    }
    await db.collection('users').doc(userId).update({ ...updates });
}

async function getNotifications(userId: string) {
    const doc = await db.collection('accounts').doc(userId).get();
    if (doc.exists) {
        const data = doc.data();
        return data?.notifications || [];
    } else {
        throw new Error('Account not found');
    }
    return null;
}

async function sendNotification(userId: string, notification: { title: string; text: string }) {
    const notifications = await getNotifications(userId) || [];
    notifications.push({ id: Date.now(), title: notification.title, text: notification.text, timestamp: new Date().toISOString(), read: false });
    await db.collection('accounts').doc(userId).update({ notifications });
}

app.get('/', (req: Request, res: Response) => res.sendFile(path.join(__dirname, '../public/templates/index.html')));
app.get('/index', (req: Request, res: Response) => res.sendFile(path.join(__dirname, '../public/templates/index.html')));
app.get('/pagenotfound', (req: Request, res: Response) => res.sendFile(path.join(__dirname, '../public/templates/pagenotfound.html')));
app.get('/auth', (req: Request, res: Response) => res.sendFile(path.join(__dirname, '../public/templates/auth.html')));
app.get('/dashboard', (req: Request, res: Response) => res.sendFile(path.join(__dirname, '../public/templates/dashboard.html')));
app.get('/playground', (req: Request, res: Response) => res.sendFile(path.join(__dirname, '../public/templates/selCodeLang.html')));
app.get('/playground/:id', (req: Request, res: Response) => res.sendFile(path.join(__dirname, '../public/templates/playground.html')));

app.get('/health', (req: Request, res: Response) => res.json({ status: 'ok', timestamp: new Date().toLocaleString() }));

app.post('/auth/register', async (req: Request, res: Response) => {
    try {
        const { email, password, name } = req.body;
        if (!email || !password || !name || password.length < 6) return res.status(400).json({ error: 'Invalid input' });
        const existing = await db.collection('accounts').where('email', '==', email).get();
        if (!existing.empty) return res.status(409).json({ error: 'Email already registered' });
        const passwordHash = hashPassword(password);
        const accountRef = await db.collection('accounts').add({ email, passwordHash, notifications: [] });
        const token = createToken(accountRef.id, email);
        await db.collection('users').doc(accountRef.id).set({
            id: accountRef.id, name, level: 1, xp: 0, streak: 0, achievements: [], photo: '', codes: [],
            createdAt: new Date().toISOString(), updatedAt: new Date().toISOString()
        });
        res.status(201).json({ token, user: { id: accountRef.id, email, name } });
        sendNotification(accountRef.id, { title: 'Welcome to Sololearn 2.0!', text: 'Thanks for joining us. Start coding!' }).catch(console.error);
    } catch (err) {
        console.error(err);
        res.status(500).json({ error: 'Registration failed' });
    }
});

app.post('/auth/login', async (req: Request, res: Response) => {
    try {
        const { email, password } = req.body;
        if (!email || !password) return res.status(400).json({ error: 'Email and password required' });
        const snapshot = await db.collection('accounts').where('email', '==', email).get();
        if (snapshot.empty) return res.status(401).json({ error: 'Invalid email or password' });
        const account = snapshot.docs[0];
        if (!verifyPassword(password, account.data().passwordHash)) return res.status(401).json({ error: 'Invalid email or password' });
        const token = createToken(account.id, email);
        res.json({ token, user: { id: account.id, email } });
    } catch (err) {
        console.error(err);
        res.status(500).json({ error: 'Login failed' });
    }
});

app.get('/auth/me', authMiddleware, async (req: Request, res: Response) => {
    try {
        const userId = req.user!.userId;
        const user = await getUser(userId);
        if (!user) return res.status(404).json({ error: 'User not found' });
        const notifications = await getNotifications(userId) || [];
        res.json({ user: { ...user, notifications } });
    } catch (err) { res.status(500).json({ error: 'Failed to get user' }); }
});

app.put('/auth/me', authMiddleware, async (req: Request, res: Response) => {
    try {
        const userId = req.user!.userId;
        const { name, photo } = req.body;
        if (!name && !photo) return res.status(400).json({ error: 'Provide name or photo' });
        const updates: Partial<User> = {};
        if (name) updates.name = name.trim() || 'Unknown';
        if (photo) updates.photo = photo.trim() || '';
        await updateUser(userId, updates);
        const user = await getUser(userId);
        res.json({ user });
    } catch (err) { res.status(500).json({ error: 'Update failed' }); }
});

app.put('/auth/notifications', authMiddleware, async (req: Request, res: Response) => {
    try {
        const userId = req.user!.userId;
        const { action, notificationId, notificationIds } = req.body;
        let notifications = await getNotifications(userId) || [];
        switch (action) {
            case 'mark_read':
                notifications = notifications.map((n: any) => n.id == notificationId ? { ...n, read: true } : n);
                break;
            case 'mark_all_read':
                notifications = notifications.map((n: any) => notificationIds.includes(n.id) ? { ...n, read: true } : n);
                break;
            case 'clear_all':
                notifications = notifications.filter((n: any) => !notificationIds.includes(n.id));
                break;
            default: return res.status(400).json({ error: 'Invalid action' });
        }
        await db.collection('accounts').doc(userId).update({ notifications });
        const user = await getUser(userId);
        res.json({ user: { ...user, notifications } });
    } catch (err) { res.status(500).json({ error: 'Notification update failed' }); }
});

app.get('/api/users', authMiddleware, async (req: Request, res: Response) => {
    try {
        const userId = req.user!.userId;
        const users = await getUsers(userId);
        res.json(users);
    } catch (err) { res.status(500).json({ error: 'Failed to get users' }); }
});

app.put('/api/users/:userId', authMiddleware, async (req: Request, res: Response) => {
    try {
        const { userId } = req.params;
        const updates = req.body;
        await updateUser(userId, updates);
        const user = await getUser(userId);
        res.json(user);
    } catch (err) { res.status(500).json({ error: 'Update failed' }); }
});

app.delete('/api/users/:userId', authMiddleware, async (req: Request, res: Response) => {
    try {
        await db.collection('users').doc(req.params.userId).delete();
        await db.collection('accounts').doc(req.params.userId).delete();
        res.json({ message: 'User deleted' });
    } catch (err) { res.status(500).json({ error: 'Delete failed' }); }
});

app.post('/api/codes', authMiddleware, async (req: Request, res: Response) => {
    try {
        const userId = req.user!.userId;
        const { title, language, description, isPublic, files } = req.body;
        if (!title?.trim() || !files || !Array.isArray(files) || !language?.trim()) return res.status(400).json({ error: 'Required fields missing' });
        const user = await getUser(userId);
        if (!user) return res.status(404).json({ error: 'User not found' });
        const newCode: Code = { id: Date.now(), userid: userId, title, language, description, files, views: 0, likedBy: [], isPublic: isPublic !== false, createdAt: new Date().toISOString(), updatedAt: new Date().toISOString() };
        user.codes.push(newCode);
        await updateUser(userId, { codes: user.codes }, false);
        res.status(201).json(newCode);
    } catch (err) { res.status(500).json({ error: 'Create code failed' }); }
});

app.put('/api/codes/:codeId', authMiddleware, async (req: Request, res: Response) => {
    try {
        const userId = req.user!.userId;
        const { codeId } = req.params;
        const { title, language, description, isPublic, files } = req.body;
        if (!title?.trim() || !files || !Array.isArray(files) || !language?.trim()) return res.status(400).json({ error: 'Required fields missing' });
        const user = await getUser(userId);
        if (!user) return res.status(404).json({ error: 'User not found' });
        const idx = user.codes.findIndex(c => c.id == Number(codeId));
        let resultCode: Code;
        if (idx !== -1) {
            user.codes[idx] = { ...user.codes[idx], title, language, description, files, isPublic: isPublic !== false, updatedAt: new Date().toISOString() };
            resultCode = user.codes[idx];
        } else {
            const newCode: Code = { id: Date.now(), userid: userId, title, language, description, files, views: 0, likedBy: [], isPublic: isPublic !== false, createdAt: new Date().toISOString(), updatedAt: new Date().toISOString() };
            user.codes.push(newCode);
            resultCode = newCode;
        }
        await updateUser(userId, { codes: user.codes }, false);
        res.status(201).json(resultCode);
    } catch (err) { res.status(500).json({ error: 'Update code failed' }); }
});

app.delete('/api/codes/:codeId', authMiddleware, async (req: Request, res: Response) => {
    try {
        const userId = req.user!.userId;
        const user = await getUser(userId);
        if (!user) return res.status(404).json({ error: 'User not found' });
        const idx = user.codes.findIndex(c => c.id == Number(req.params.codeId));
        if (idx === -1) return res.status(404).json({ error: 'Code not found' });
        user.codes.splice(idx, 1);
        await updateUser(userId, { codes: user.codes }, false);
        res.json({ message: 'Code deleted' });
    } catch (err) { res.status(500).json({ error: 'Delete code failed' }); }
});

app.get('/api/codes/:codeId', authMiddleware, async (req: Request, res: Response) => {
    try {
        const userId = req.user!.userId;
        const users = await getUsers(userId);
        const { codeId } = req.params;
        for (const userData of users) {
            const codes = userData.codes || [];
            const code = codes.find((c: Code) => c.id == Number(codeId));
            if (code) {
                return res.json(code);
            }
        }
        res.status(404).json({ error: 'Code not found or private' });
    } catch (err) { res.status(500).json({ error: 'Get code failed' }); }
});

app.post('/api/codes/:codeId/like', authMiddleware, async (req: Request, res: Response) => {
    try {
        const userId = req.user!.userId;
        const users = await getUsers(userId);
        const { codeId } = req.params;
        for (const userData of users) {
            const codes = userData.codes || [];
            const idx = codes.findIndex((c: Code) => c.id == Number(codeId));
            if (idx !== -1) {
                const code = codes[idx];
                const likedBy = code.likedBy || [];
                const already = likedBy.includes(userId);
                if (already) likedBy.splice(likedBy.indexOf(userId), 1);
                else likedBy.push(userId);
                codes[idx].likedBy = likedBy;
                await updateUser(userData.id, { codes }, false);
                return res.json({ success: true, code: codes[idx], liked: !already });
            }
        }
        res.status(404).json({ success: false, error: 'Code not found' });
    } catch (err) { res.status(500).json({ success: false, error: 'Like failed' }); }
});

app.post('/api/codes/:codeId/view', authMiddleware, async (req: Request, res: Response) => {
    try {
        const userId = req.user!.userId;
        const users = await getUsers(userId);
        const { codeId } = req.params;
        for (const userData of users) {
            const codes = userData.codes || [];
            const idx = codes.findIndex((c: Code) => c.id == Number(codeId));
            if (idx !== -1) {
                codes[idx].views = (codes[idx].views || 0) + 1;
                await updateUser(userData.id, { codes }, false);
                return res.json({ success: true, views: codes[idx].views });
            }
        }
        res.status(404).json({ success: false, error: 'Code not found' });
    } catch (err) { res.status(500).json({ success: false, error: 'View failed' }); }
});

app.post('/api/execute', authMiddleware, async (req: Request, res: Response) => {
    res.status(500).json({ error: 'You can only run web code (HTML, CSS, and JavaScript)' });
});

app.get('/:name', (req: Request, res: Response) => {
    const filePath = path.join(__dirname, `../public/static/${req.params.name}`);
    fs.existsSync(filePath) ? res.sendFile(filePath) : res.redirect('/pagenotfound');
});

app.use((err: any, req: Request, res: Response, next: NextFunction) => {
    console.error('Error:', err);
    res.status(500).json({ error: 'Internal server error' });
});

export default app;

if (require.main === module) {
    const PORT = process.env.PORT || 3000;
    app.listen(PORT, () => {
        console.log(`Server running on port ${PORT}`);
    });
}
