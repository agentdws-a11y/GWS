require('dotenv').config();

const bcrypt = require('bcryptjs');
const pool = require('./db');

async function seedAdmin() {
    try {
        const name = 'HR Admin';
        const email = 'admin@hyre.ai';
        const password = 'Admin123!';

        const [existingUsers] = await pool.execute(
            'SELECT id FROM Users WHERE email = ?',
            [email]
        );

        if (existingUsers.length > 0) {
            console.log('HR Admin already exists.');
            return;
        }

        const passwordHash = await bcrypt.hash(password, 10);

        await pool.execute(
            'INSERT INTO Users (name, email, password_hash, role) VALUES (?, ?, ?, ?)',
            [name, email, passwordHash, 'HR_ADMIN']
        );

        console.log('HR Admin created successfully.');
        console.log(`Email: ${email}`);
        console.log(`Password: ${password}`);

    } catch (error) {
        console.error('Failed to create HR Admin:', error);
    } finally {
        await pool.end();
    }
}

seedAdmin();