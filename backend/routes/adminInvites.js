const express = require('express');
const pool = require('../db');
const bcrypt = require('bcryptjs');
const crypto = require('crypto');
const authenticateToken = require('../middleware/authenticate');
const authorize = require('../middleware/authorize');
const { sendAdminInviteEmail } = require('../services/emailService');

const router = express.Router();

function generateInviteToken() {
    return crypto.randomBytes(32).toString('hex');
}

function isValidEmail(email) {
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    return emailRegex.test(email);
}

router.post('/', authenticateToken, authorize('HR_ADMIN'), async (req, res) => {
    const connection = await pool.getConnection();

    try {
        await connection.beginTransaction();

        const { email, name } = req.body;

        if (!email || !email.trim()) {
            await connection.rollback();
            return res.status(400).json({ message: 'Email is required' });
        }

        if (!isValidEmail(email.trim())) {
            await connection.rollback();
            return res.status(400).json({ message: 'Invalid email format' });
        }

        if (!name || !name.trim()) {
            await connection.rollback();
            return res.status(400).json({ message: 'Name is required' });
        }

        const emailLower = email.trim().toLowerCase();
        const nameTrimmed = name.trim();

        const [existingUsers] = await connection.execute(
            'SELECT id, role FROM Users WHERE LOWER(email) = ?',
            [emailLower]
        );

        if (existingUsers.length > 0) {
            await connection.rollback();
            return res.status(409).json({ 
                message: 'A user with this email already exists' 
            });
        }

        const [existingInvites] = await connection.execute(
            `SELECT id, status, expires_at 
             FROM AdminInvites 
             WHERE LOWER(email) = ? AND status = 'PENDING'`,
            [emailLower]
        );

        if (existingInvites.length > 0) {
            const invite = existingInvites[0];
            const now = new Date();
            const expiresAt = new Date(invite.expires_at);

            if (expiresAt > now) {
                await connection.rollback();
                return res.status(409).json({ 
                    message: 'An active invitation already exists for this email' 
                });
            }
        }

        let token;
        let isUnique = false;
        let attempts = 0;

        while (!isUnique && attempts < 5) {
            token = generateInviteToken();
            const [existing] = await connection.execute(
                'SELECT id FROM AdminInvites WHERE token = ?',
                [token]
            );
            if (existing.length === 0) {
                isUnique = true;
            }
            attempts++;
        }

        if (!isUnique) {
            await connection.rollback();
            return res.status(500).json({ message: 'Failed to generate unique token' });
        }

        const expiresAt = new Date();
        expiresAt.setDate(expiresAt.getDate() + 7);

        const [result] = await connection.execute(
            `INSERT INTO AdminInvites (email, token, invited_by, expires_at) 
             VALUES (?, ?, ?, ?)`,
            [emailLower, token, req.user.userId, expiresAt]
        );

        await connection.commit();

        const inviteLink = `${process.env.FRONTEND_URL || 'http://localhost:5173'}/admin-register/${token}`;

        const [inviter] = await connection.execute(
            'SELECT name FROM Users WHERE id = ?',
            [req.user.userId]
        );
        const inviterName = inviter[0]?.name || 'Your colleague';

        const emailResult = await sendAdminInviteEmail(
            emailLower,
            nameTrimmed,
            inviteLink,
            inviterName
        );

        if (emailResult.sent) {
            res.status(201).json({
                message: `Invitation sent successfully to ${emailLower}`,
                inviteId: result.insertId,
                expiresAt,
                emailSent: true
            });
        } else {
            res.status(201).json({
                message: 'Invitation created successfully',
                inviteId: result.insertId,
                inviteLink,
                expiresAt,
                emailSent: false,
                emailError: emailResult.reason || emailResult.error
            });
        }

    } catch (error) {
        await connection.rollback();
        console.error('Create admin invite error:', error);
        res.status(500).json({ message: 'Server error' });
    } finally {
        connection.release();
    }
});

router.get('/', authenticateToken, authorize('HR_ADMIN'), async (req, res) => {
    try {
        const query = `
            SELECT 
                ai.id,
                ai.email,
                ai.status,
                ai.expires_at,
                ai.accepted_at,
                ai.created_at,
                u.name AS invited_by_name,
                u.email AS invited_by_email
            FROM AdminInvites ai
            JOIN Users u ON ai.invited_by = u.id
            ORDER BY ai.created_at DESC
        `;

        const [invites] = await pool.execute(query);

        res.json({ invites });

    } catch (error) {
        console.error('Get admin invites error:', error);
        res.status(500).json({ message: 'Server error' });
    }
});


router.get('/verify/:token', async (req, res) => {
    try {
        const { token } = req.params;

        const [invites] = await pool.execute(
            `SELECT 
                ai.id,
                ai.email,
                ai.status,
                ai.expires_at,
                u.name AS invited_by_name
             FROM AdminInvites ai
             JOIN Users u ON ai.invited_by = u.id
             WHERE ai.token = ?`,
            [token]
        );

        if (invites.length === 0) {
            return res.status(404).json({ 
                valid: false,
                message: 'Invalid invitation link' 
            });
        }

        const invite = invites[0];

        if (invite.status === 'ACCEPTED') {
            return res.status(400).json({ 
                valid: false,
                message: 'This invitation has already been used' 
            });
        }

        const now = new Date();
        const expiresAt = new Date(invite.expires_at);

        if (expiresAt < now) {
            await pool.execute(
                "UPDATE AdminInvites SET status = 'EXPIRED' WHERE id = ?",
                [invite.id]
            );

            return res.status(400).json({ 
                valid: false,
                message: 'This invitation has expired' 
            });
        }

        res.json({
            valid: true,
            email: invite.email,
            invitedBy: invite.invited_by_name
        });

    } catch (error) {
        console.error('Verify invite token error:', error);
        res.status(500).json({ message: 'Server error' });
    }
});

router.post('/accept', async (req, res) => {
    const connection = await pool.getConnection();

    try {
        await connection.beginTransaction();

        const { token, name, password } = req.body;

        if (!token || !token.trim()) {
            await connection.rollback();
            return res.status(400).json({ message: 'Invite token is required' });
        }

        if (!name || !name.trim()) {
            await connection.rollback();
            return res.status(400).json({ message: 'Name is required' });
        }

        if (!password || password.length < 6) {
            await connection.rollback();
            return res.status(400).json({ 
                message: 'Password must be at least 6 characters' 
            });
        }

        const [invites] = await connection.execute(
            `SELECT id, email, status, expires_at 
             FROM AdminInvites 
             WHERE token = ? FOR UPDATE`,
            [token.trim()]
        );

        if (invites.length === 0) {
            await connection.rollback();
            return res.status(404).json({ message: 'Invalid invitation link' });
        }

        const invite = invites[0];

        if (invite.status === 'ACCEPTED') {
            await connection.rollback();
            return res.status(400).json({ 
                message: 'This invitation has already been used' 
            });
        }

        const now = new Date();
        const expiresAt = new Date(invite.expires_at);

        if (expiresAt < now) {
            await connection.execute(
                "UPDATE AdminInvites SET status = 'EXPIRED' WHERE id = ?",
                [invite.id]
            );
            await connection.rollback();
            return res.status(400).json({ 
                message: 'This invitation has expired' 
            });
        }

        const [existingUsers] = await connection.execute(
            'SELECT id FROM Users WHERE LOWER(email) = ?',
            [invite.email.toLowerCase()]
        );

        if (existingUsers.length > 0) {
            await connection.rollback();
            return res.status(409).json({ 
                message: 'A user with this email already exists' 
            });
        }

        const passwordHash = await bcrypt.hash(password, 10);

        const [userResult] = await connection.execute(
            `INSERT INTO Users (name, email, password_hash, role) 
             VALUES (?, ?, ?, 'HR_ADMIN')`,
            [name.trim(), invite.email, passwordHash]
        );

        await connection.execute(
            `UPDATE AdminInvites 
             SET status = 'ACCEPTED', accepted_at = NOW() 
             WHERE id = ?`,
            [invite.id]
        );

        await connection.commit();

        res.status(201).json({
            message: 'Admin account created successfully',
            userId: userResult.insertId
        });

    } catch (error) {
        await connection.rollback();
        console.error('Accept invite error:', error);
        res.status(500).json({ message: 'Server error' });
    } finally {
        connection.release();
    }
});

router.delete('/:id', authenticateToken, authorize('HR_ADMIN'), async (req, res) => {
    try {
        const { id } = req.params;

        const [invites] = await pool.execute(
            'SELECT id, email, status FROM AdminInvites WHERE id = ?',
            [id]
        );

        if (invites.length === 0) {
            return res.status(404).json({ message: 'Invitation not found' });
        }

        const invite = invites[0];

        if (invite.status !== 'PENDING') {
            return res.status(400).json({ 
                message: `Cannot delete ${invite.status.toLowerCase()} invitation` 
            });
        }

        await pool.execute('DELETE FROM AdminInvites WHERE id = ?', [id]);

        res.json({ message: 'Invitation cancelled successfully' });

    } catch (error) {
        console.error('Delete invite error:', error);
        res.status(500).json({ message: 'Server error' });
    }
});

module.exports = router;
