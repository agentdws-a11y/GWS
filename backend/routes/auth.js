const express = require('express');
const bcrypt = require('bcryptjs');
const pool = require('../db');
const jwt = require('jsonwebtoken');

const router = express.Router();

router.post('/register', async (req, res) => {
    try {
        const { name, email, password } = req.body;

if (!name || !email || !password) {
    return res.status(400).json({
        message: 'All fields are required'
    });
}

if (name.trim().length < 2) {
    return res.status(400).json({
        message: 'Name must be at least 2 characters'
    });
}

const emailPattern = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

if (!emailPattern.test(email)) {
    return res.status(400).json({
        message: 'Please enter a valid email address'
    });
}

if (password.length < 8) {
    return res.status(400).json({
        message: 'Password must be at least 8 characters'
    });
}

if (!/[A-Z]/.test(password)) {
    return res.status(400).json({
        message: 'Password must contain at least 1 uppercase letter'
    });
}

if (!/[a-z]/.test(password)) {
    return res.status(400).json({
        message: 'Password must contain at least 1 lowercase letter'
    });
}

if (!/[0-9]/.test(password)) {
    return res.status(400).json({
        message: 'Password must contain at least 1 number'
    });
}

if (!/[!@#$%^&*(),.?":{}|<>_\-\\[\]/`~+=;']/.test(password)) {
    return res.status(400).json({
        message: 'Password must contain at least 1 special character'
    });
}

        const [existingUsers] = await pool.execute(
            'SELECT id FROM Users WHERE email = ?',
            [email]
        );

        if (existingUsers.length > 0) {
            return res.status(409).json({
                message: 'Email already registered'
            });
        }

        const passwordHash = await bcrypt.hash(password, 10);

        await pool.execute(
            'INSERT INTO Users (name, email, password_hash, role) VALUES (?, ?, ?, ?)',
            [name, email, passwordHash, 'CANDIDATE']
        );

        res.status(201).json({
            message: 'Candidate registered successfully'
        });

    } catch (error) {
        console.error('Registration error:', error);

        res.status(500).json({
            message: 'Server error'
        });
    }
});

router.post('/login', async (req, res) => {
    try {
        const { email, password } = req.body;

        if (!email || !password) {
            return res.status(400).json({
                message: 'Email and password are required'
            });
        }

        const [users] = await pool.execute(
            'SELECT id, name, email, password_hash, role FROM Users WHERE email = ?',
            [email]
        );

        if (users.length === 0) {
            return res.status(401).json({
                message: 'Invalid email or password'
            });
        }

        const user = users[0];

        const passwordMatch = await bcrypt.compare(
            password,
            user.password_hash
        );

        if (!passwordMatch) {
            return res.status(401).json({
                message: 'Invalid email or password'
            });
        }

        const token = jwt.sign(
            {
                userId: user.id,
                role: user.role
            },
            process.env.JWT_SECRET,
            {
                expiresIn: '8h'
            }
        );

        res.json({
            message: 'Login successful',
            token,
            user: {
                id: user.id,
                name: user.name,
                email: user.email,
                role: user.role
            }
        });

    } catch (error) {
        console.error('Login error:', error);

        res.status(500).json({
            message: 'Server error'
        });
    }
});

module.exports = router;