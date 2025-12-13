require('dotenv').config();
const express = require('express');
const cors = require('cors');
const admin = require('firebase-admin');
const path = require('path');
const fs = require('fs');
const { hashPassword, verifyPassword, createToken, authMiddleware } = require('./auth-service');

interface Code {
    id: number;
    userid: string;
    title: string;
    language: string;
    description: string;
    code: string;
    views: number;
    likedBy: string[];
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

const raw = process.env.FIREKEY_JSON;
let serviceAccount;
if (!raw) {
    console.error('Missing FIREKEY_JSON environment variable.');
    process.exit(1);
}
try {
    serviceAccount = JSON.parse(raw);
} catch (e) {
    console.error('Failed to parse FIREKEY_JSON as JSON:', e.message);
    process.exit(1);
}

try {
    admin.initializeApp({
        credential: admin.credential.cert(serviceAccount),
        projectId: serviceAccount.project_id
    });
} catch (err) {
    console.error('❌ Firebase init failed:', err.message);
    process.exit(1);
}

const db = admin.firestore();

app.get('/', (req, res) => {
    res.sendFile(path.join(__dirname, '../public/templates/index.html'));
});

app.get('/health', (req, res) => {
    res.status(200).json({ status: 'ok', timestamp: new Date().toLocaleString('en-US', { year: 'numeric', month: '2-digit', day: '2-digit', hour: '2-digit', minute: '2-digit', hour12: true }) });
});

app.post('/auth/register', async (req, res) => {
    try {
        const { email, password, name } = req.body;

        if (!email || !password || !name) {
            return res.status(400).json({ error: 'Email, password, and name are required' });
        }
        if (password.length < 6) {
            return res.status(400).json({ error: 'Password must be at least 6 characters' });
        }

        const existingUser = await db.collection('accounts').where('email', '==', email).get();
        if (!existingUser.empty) {
            return res.status(409).json({ error: 'Email already registered' });
        }
        const passwordHash = hashPassword(password);
        const accountRef = await db.collection('accounts').add({
            email, passwordHash
        });

        const token = createToken(accountRef.id, email);
        await db.collection('users').doc(accountRef.id).set({
            id: accountRef.id,
            name,
            level: 1,
            xp: 0,
            streak: 0,
            achievements: [],
            photo: '',
            codes: [],
            createdAt: new Date().toISOString(),
            updatedAt: new Date().toISOString()
        });

        res.status(201).json({
            token,
            user: { id: accountRef.id, email, name }
        });
    } catch (err) {
        console.error('POST /auth/register error:', err);
        res.status(500).json({ error: "An error occurred during registration." });
    }
});

app.post('/auth/login', async (req, res) => {
    try {
        const { email, password } = req.body;

        if (!email || !password) {
            return res.status(400).json({ error: 'Email and password are required' });
        }

        const snapshot = await db.collection('accounts').where('email', '==', email).get();
        if (snapshot.empty) {
            return res.status(401).json({ error: 'Invalid email or password' });
        }

        const account = snapshot.docs[0];
        const accountData = account.data();

        if (!verifyPassword(password, accountData.passwordHash)) {
            return res.status(401).json({ error: 'Invalid email or password' });
        }

        const token = createToken(account.id, email);

        res.json({
            token,
            user: {
                id: account.id,
                email: accountData.email,
            }
        });
    } catch (err) {
        console.error('POST /auth/login error:', err);
        res.status(500).json({ error: "An error occurred during authorization." });
    }
});

app.get('/auth/me', authMiddleware, async (req, res) => {
    try {
        const user = await db.collection('users').doc(req.user.userId).get();
        if (!user.exists) {
            return res.status(404).json({ error: 'User not found' });
        }
        const userData = user.data() as User;
        res.json({
            user: {
                id: user.id,
                ...userData
            }
        });
    } catch (err) {
        console.error('GET /auth/me error:', err);
        res.status(500).json({ error: err.message });
    }
});

app.put('/auth/me', authMiddleware, async (req, res) => {
    try {
        const userId = req.user.userId;
        const { name, photo } = req.body;

        if (!name && !photo) {
            return res.status(400).json({ error: 'At least one of name or photo must be provided' });
        }

        const userRef = db.collection('users').doc(userId);
        const userDoc = await userRef.get();
        if (!userDoc.exists) return res.status(404).json({ error: 'User not found' });

        const updates: Partial<User> = {};
        if (name) updates.name = name.trim() || 'Unknown';
        if (photo) updates.photo = photo.trim() || '';
        updates.updatedAt = new Date().toISOString();

        await userRef.update(updates);

        const updated = await userRef.get();
        res.json({ user: { id: updated.id, ...updated.data() as User } });
    } catch (err) {
        console.error('PUT /auth/me error:', err);
        res.status(500).json({ error: err.message });
    }
});

app.get('/api/users', authMiddleware, async (req, res) => {
    try {
        const snapshot = await db.collection('users').get();
        const users = snapshot.docs.map(doc => ({
            id: doc.id,
            ...doc.data() as User
        }));
        res.json(users);
    } catch (err) {
        console.error('GET /api/users error:', err);
        res.status(500).json({ error: err.message });
    }
});

app.post('/api/users/create', authMiddleware, async (req, res) => {
    try {
        const { name } = req.body;

        if (!name || typeof name !== 'string' || name.trim().length === 0) {
            return res.status(400).json({ error: 'Name is required and must be a non-empty string' });
        }

        const user = {
            name: name.trim(),
            level: 1,
            xp: 0,
            streak: 0,
            achievements: [],
            photo: '',
            codes: [],
            createdAt: new Date().toISOString(),
            updatedAt: new Date().toISOString()
        };

        const docRef = await db.collection('users').add(user);
        res.status(201).json({
            id: docRef.id,
            ...user
        });
    } catch (err) {
        console.error('POST /api/users/create error:', err);
        res.status(500).json({ error: err.message });
    }
});

app.put('/api/users/:userId', authMiddleware, async (req, res) => {
    try {
        const { userId } = req.params;
        const { name, level, xp, streak, achievements, codes } = req.body;

        const updateData: Partial<User> = {
            updatedAt: new Date().toISOString()
        };

        if (name !== undefined) updateData.name = name;
        if (level !== undefined) updateData.level = level;
        if (xp !== undefined) updateData.xp = xp;
        if (streak !== undefined) updateData.streak = streak;
        if (achievements !== undefined) updateData.achievements = achievements;
        if (codes !== undefined) updateData.codes = codes;

        await db.collection('users').doc(userId).update(updateData);

        const doc = await db.collection('users').doc(userId).get();
        res.json({
            id: doc.id,
            ...doc.data() as User
        });
    } catch (err) {
        console.error('PUT /api/users/:userId error:', err);
        res.status(500).json({ error: err.message });
    }
});

app.delete('/api/users/:userId', authMiddleware, async (req, res) => {
    try {
        const { userId } = req.params;
        await db.collection('users').doc(userId).delete();
        res.json({ message: `User ${userId} deleted successfully` });
    } catch (err) {
        console.error('DELETE /api/users/:userId error:', err);
        res.status(500).json({ error: err.message });
    }
});

app.post('/api/codes', authMiddleware, async (req, res) => {
    try {
        const { title, language, description, code } = req.body;
        const userId = req.user.userId;

        if (!title.trim()) {
            return res.status(400).json({ error: 'Title are required' });
        }
        if (!code) {
            return res.status(400).json({ error: 'Code are required' });
        }
        if (!language.trim()) {
            return res.status(400).json({ error: 'Language are required' });
        }
        const currDate = new Date().toISOString();
        const newCode = {
            id: Date.now(),
            userid: userId,
            title: title,
            language: language,
            description: description,
            code: code,
            views: 0,
            likedBy: [],
            createdAt: currDate,
            updatedAt: currDate
        };

        const userDoc = await db.collection('users').doc(userId).get();
        if (!userDoc.exists) {
            return res.status(404).json({ error: 'User not found' });
        }

        const userData = userDoc.data() as User;
        const codes = userData.codes || [];
        codes.push(newCode);

        await db.collection('users').doc(userId).update({ codes });

        res.status(201).json(newCode);
    } catch (err) {
        console.error('POST /api/codes error:', err);
        res.status(500).json({ error: err.message });
    }
});

app.put('/api/codes/:codeId', authMiddleware, async (req, res) => {
    try {
        const { codeId } = req.params;
        const { title, language, description, code } = req.body;
        const userId = req.user.userId;

        if (!title.trim()) {
            return res.status(400).json({ error: 'Title are required' });
        }
        if (!code) {
            return res.status(400).json({ error: 'Code are required' });
        }
        if (!language.trim()) {
            return res.status(400).json({ error: 'Language are required' });
        }

        const userDoc = await db.collection('users').doc(userId).get();
        if (!userDoc.exists) {
            return res.status(404).json({ error: 'User not found' });
        }

        const userData = userDoc.data() as User;
        const codes = userData.codes || [];
        const codeIndex = codes.findIndex(c => c.id === parseInt(codeId));

        if (codeIndex === -1) {
            return res.status(404).json({ error: 'Code not found' });
        }

        codes[codeIndex] = {
            ...codes[codeIndex],
            title: title,
            language: language,
            description: description,
            code: code,
            updatedAt: new Date().toISOString()
        };

        await db.collection('users').doc(userId).update({ codes });

        res.json(codes[codeIndex]);
    } catch (err) {
        console.error('PUT /api/codes/:codeId error:', err);
        res.status(500).json({ error: err.message });
    }
});

app.delete('/api/codes/:codeId', authMiddleware, async (req, res) => {
    try {
        const { codeId } = req.params;
        const userId = req.user.userId;

        const userDoc = await db.collection('users').doc(userId).get();
        if (!userDoc.exists) {
            return res.status(404).json({ error: 'User not found' });
        }

        const userData = userDoc.data() as User;
        const codes = userData.codes || [];
        const codeIndex = codes.findIndex(c => c.id === parseInt(codeId));

        if (codeIndex === -1) {
            return res.status(404).json({ error: 'Code not found or you do not have permission to delete it' });
        }

        codes.splice(codeIndex, 1);

        await db.collection('users').doc(userId).update({ codes });

        res.json({ message: 'Code deleted successfully' });
    } catch (err) {
        console.error('DELETE /api/codes/:codeId error:', err);
        res.status(500).json({ error: err.message });
    }
});

app.post('/api/codes/:codeId/like', authMiddleware, async (req, res) => {
    try {
        const { codeId } = req.params;

        const snapshot = await db.collection('users').get();
        for (const doc of snapshot.docs) {
            const userData = doc.data() as User;
            const codes = userData.codes || [];
            const idx = codes.findIndex(c => String(c.id) === String(codeId));
            if (idx !== -1) {
                const likedBy = Array.isArray(codes[idx].likedBy) ? codes[idx].likedBy : [];
                const requesterId = req.user && req.user.userId ? req.user.userId : null;
                let liked = false;
                const alreadyIndex = requesterId ? likedBy.findIndex(u => String(u) === String(requesterId)) : -1;
                if (alreadyIndex === -1 && requesterId) {
                    likedBy.push(requesterId);
                    liked = true;
                } else if (alreadyIndex !== -1) {
                    likedBy.splice(alreadyIndex, 1);
                    liked = false;
                }
                codes[idx].likedBy = likedBy;
                await db.collection('users').doc(doc.id).update({ codes });
                return res.json({ success: true, code: codes[idx], liked });
            }
        }
        return res.status(404).json({ error: 'Code not found' });
    } catch (err) {
        console.error('POST /api/codes/:codeId/like error:', err);
        res.status(500).json({ error: err.message });
    }
});

app.post('/api/codes/:codeId/view', authMiddleware, async (req, res) => {
    try {
        const { codeId } = req.params;

        const snapshot = await db.collection('users').get();
        for (const doc of snapshot.docs) {
            const userData = doc.data() as User;
            const codes = userData.codes || [];
            const idx = codes.findIndex(c => String(c.id) === String(codeId));
            if (idx !== -1) {
                codes[idx].views = (codes[idx].views || 0) + 1;
                await db.collection('users').doc(doc.id).update({ codes });
                return res.json({ success: true, views: codes[idx].views });
            }
        }
        return res.status(404).json({ error: 'Code not found' });
    } catch (err) {
        console.error('POST /api/codes/:codeId/view error:', err);
        res.status(500).json({ error: err.message });
    }
});

app.get('/:name', (req, res) => {
    const { name } = req.params;
    const filePath = {
        templates: path.join(__dirname, `../public/templates/${name}.html`),
        static: path.join(__dirname, `../public/static/${name}`)
    };
    fs.existsSync(filePath.templates) ? res.sendFile(filePath.templates) : fs.existsSync(filePath.static) ? res.sendFile(filePath.static) : res.status(404).json({ error: 'URL not found' });
});

app.use((err, req, res, next) => {
    console.error('Unhandled error:', err);
    res.status(500).json({ error: 'Internal server error' });
});

export default app
