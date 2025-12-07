const crypto = require('crypto');
const jwt = require('jsonwebtoken');

const JWT_SECRET = process.env.JWT_SECRET;

function hashPassword(password) {
    const salt = crypto.randomBytes(16).toString('hex');
    const hash = crypto.pbkdf2Sync(password, salt, 100000, 64, 'sha512').toString('hex');
    return `${salt}:${hash}`;
}

function verifyPassword(password, storedHash) {
    try {
        const [salt, hash] = storedHash.split(':');
        const computed = crypto.pbkdf2Sync(password, salt, 100000, 64, 'sha512').toString('hex');
        return computed === hash;
    } catch (e) {
        return false;
    }
}

function createToken(userId, email) {
    return jwt.sign(
        { userId, email, iat: Date.now() }, JWT_SECRET, { expiresIn: '7d' }
    );
}

function authMiddleware(req, res, next) {
    const token = req.headers.authorization?.split(' ')[1] || req.query.token;
    if (!token) {
        return res.status(401).json({ error: 'Missing authorization token' });
    }
    let decoded;
    try {
        decoded = jwt.verify(token, JWT_SECRET);
    } catch {
        decoded = null;
    }
    if (!decoded || decoded == null || (decoded.exp && decoded.exp * 1000 < Date.now())) {
        return res.status(401).json({ error: 'Invalid or expired token' });
    }
    req.user = decoded;
    next();
}

module.exports = {
    hashPassword,
    verifyPassword,
    createToken,
    authMiddleware,
    JWT_SECRET
};
