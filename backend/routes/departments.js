const express = require('express');
const pool = require('../db');
const authenticateToken = require('../middleware/authenticate');
const authorize = require('../middleware/authorize');

const router = express.Router();


router.get('/managers/list', authenticateToken, authorize('HR_ADMIN'), async (req, res) => {
    try {
        const [managers] = await pool.execute(
            `SELECT id, name, email 
             FROM Users 
             WHERE role = 'HR_ADMIN' 
             ORDER BY name ASC`
        );

        res.json({
            managers
        });

    } catch (error) {
        console.error('Get managers error:', error);
        res.status(500).json({
            message: 'Server error'
        });
    }
});

router.get('/', authenticateToken, authorize('HR_ADMIN'), async (req, res) => {
    try {
        const query = `
            SELECT 
                d.id,
                d.name,
                d.description,
                d.manager_id,
                u.name AS manager_name,
                u.email AS manager_email,
                d.created_at,
                d.updated_at,
                (SELECT COUNT(*) FROM Jobs WHERE department_id = d.id) AS job_count
            FROM Departments d
            LEFT JOIN Users u ON d.manager_id = u.id
            ORDER BY d.name ASC
        `;

        const [departments] = await pool.execute(query);

        res.json({
            departments
        });

    } catch (error) {
        console.error('Get departments error:', error);
        res.status(500).json({
            message: 'Server error'
        });
    }
});

router.get('/:id', authenticateToken, authorize('HR_ADMIN'), async (req, res) => {
    try {
        const { id } = req.params;

        const query = `
            SELECT 
                d.id,
                d.name,
                d.description,
                d.manager_id,
                u.name AS manager_name,
                u.email AS manager_email,
                d.created_at,
                d.updated_at,
                (SELECT COUNT(*) FROM Jobs WHERE department_id = d.id) AS job_count,
                (SELECT COUNT(*) FROM Jobs WHERE department_id = d.id AND status = 'OPEN') AS open_job_count
            FROM Departments d
            LEFT JOIN Users u ON d.manager_id = u.id
            WHERE d.id = ?
        `;

        const [departments] = await pool.execute(query, [id]);

        if (departments.length === 0) {
            return res.status(404).json({
                message: 'Department not found'
            });
        }

        res.json({
            department: departments[0]
        });

    } catch (error) {
        console.error('Get department error:', error);
        res.status(500).json({
            message: 'Server error'
        });
    }
});

function validateDepartmentFields(body) {
    const { name, description, manager_id } = body;

    if (!name || name.trim().length < 2) {
        return 'Department name must be at least 2 characters';
    }

    if (name.trim().length > 100) {
        return 'Department name must not exceed 100 characters';
    }

    if (description && description.trim().length > 5000) {
        return 'Description must not exceed 5000 characters';
    }

    if (manager_id !== undefined && manager_id !== null && manager_id !== '') {
        if (isNaN(Number(manager_id))) {
            return 'Manager ID must be a number';
        }
    }

    return null;
}

router.post('/', authenticateToken, authorize('HR_ADMIN'), async (req, res) => {
    const connection = await pool.getConnection();

    try {
        await connection.beginTransaction();

        const { name, description, manager_id } = req.body;

        const validationError = validateDepartmentFields(req.body);
        if (validationError) {
            await connection.rollback();
            return res.status(400).json({ message: validationError });
        }

        const [existingDepartments] = await connection.execute(
            'SELECT id FROM Departments WHERE LOWER(name) = LOWER(?)',
            [name.trim()]
        );

        if (existingDepartments.length > 0) {
            await connection.rollback();
            return res.status(409).json({
                message: 'A department with this name already exists'
            });
        }

        if (manager_id !== undefined && manager_id !== null && manager_id !== '') {
            const [managers] = await connection.execute(
                'SELECT id, role FROM Users WHERE id = ?',
                [manager_id]
            );

            if (managers.length === 0) {
                await connection.rollback();
                return res.status(404).json({
                    message: 'Manager not found'
                });
            }

            if (managers[0].role !== 'HR_ADMIN') {
                await connection.rollback();
                return res.status(400).json({
                    message: 'Manager must be an HR admin user'
                });
            }
        }

        const managerValue = (manager_id !== undefined && manager_id !== null && manager_id !== '') 
            ? Number(manager_id) 
            : null;

        const [result] = await connection.execute(
            'INSERT INTO Departments (name, description, manager_id) VALUES (?, ?, ?)',
            [name.trim(), description ? description.trim() : null, managerValue]
        );

        await connection.commit();

        res.status(201).json({
            message: 'Department created successfully',
            departmentId: result.insertId
        });

    } catch (error) {
        await connection.rollback();
        console.error('Create department error:', error);

        if (error.code === 'ER_DUP_ENTRY') {
            return res.status(409).json({
                message: 'A department with this name already exists'
            });
        }

        res.status(500).json({
            message: 'Server error'
        });
    } finally {
        connection.release();
    }
});

router.put('/:id', authenticateToken, authorize('HR_ADMIN'), async (req, res) => {
    const connection = await pool.getConnection();

    try {
        await connection.beginTransaction();

        const { id } = req.params;
        const { name, description, manager_id } = req.body;

        const validationError = validateDepartmentFields(req.body);
        if (validationError) {
            await connection.rollback();
            return res.status(400).json({ message: validationError });
        }

        const [existingDepartments] = await connection.execute(
            'SELECT id FROM Departments WHERE id = ? FOR UPDATE',
            [id]
        );

        if (existingDepartments.length === 0) {
            await connection.rollback();
            return res.status(404).json({
                message: 'Department not found'
            });
        }

        const [duplicateDepartments] = await connection.execute(
            'SELECT id FROM Departments WHERE LOWER(name) = LOWER(?) AND id != ?',
            [name.trim(), id]
        );

        if (duplicateDepartments.length > 0) {
            await connection.rollback();
            return res.status(409).json({
                message: 'A department with this name already exists'
            });
        }

        if (manager_id !== undefined && manager_id !== null && manager_id !== '') {
            const [managers] = await connection.execute(
                'SELECT id, role FROM Users WHERE id = ?',
                [manager_id]
            );

            if (managers.length === 0) {
                await connection.rollback();
                return res.status(404).json({
                    message: 'Manager not found'
                });
            }

            if (managers[0].role !== 'HR_ADMIN') {
                await connection.rollback();
                return res.status(400).json({
                    message: 'Manager must be an HR admin user'
                });
            }
        }

        const managerValue = (manager_id !== undefined && manager_id !== null && manager_id !== '') 
            ? Number(manager_id) 
            : null;

        await connection.execute(
            'UPDATE Departments SET name = ?, description = ?, manager_id = ? WHERE id = ?',
            [name.trim(), description ? description.trim() : null, managerValue, id]
        );

        await connection.commit();

        res.json({
            message: 'Department updated successfully'
        });

    } catch (error) {
        await connection.rollback();
        console.error('Update department error:', error);

        if (error.code === 'ER_DUP_ENTRY') {
            return res.status(409).json({
                message: 'A department with this name already exists'
            });
        }

        res.status(500).json({
            message: 'Server error'
        });
    } finally {
        connection.release();
    }
});

router.delete('/:id', authenticateToken, authorize('HR_ADMIN'), async (req, res) => {
    const connection = await pool.getConnection();

    try {
        await connection.beginTransaction();

        const { id } = req.params;

        const [departments] = await connection.execute(
            'SELECT id, name FROM Departments WHERE id = ? FOR UPDATE',
            [id]
        );

        if (departments.length === 0) {
            await connection.rollback();
            return res.status(404).json({
                message: 'Department not found'
            });
        }

        const [jobs] = await connection.execute(
            'SELECT COUNT(*) AS count FROM Jobs WHERE department_id = ?',
            [id]
        );

        if (jobs[0].count > 0) {
            await connection.rollback();
            return res.status(400).json({
                message: `Cannot delete department "${departments[0].name}" because it has ${jobs[0].count} job(s) associated with it. Please reassign the jobs first.`
            });
        }

        await connection.execute(
            'DELETE FROM Departments WHERE id = ?',
            [id]
        );

        await connection.commit();

        res.json({
            message: 'Department deleted successfully'
        });

    } catch (error) {
        await connection.rollback();
        console.error('Delete department error:', error);
        res.status(500).json({
            message: 'Server error'
        });
    } finally {
        connection.release();
    }
});

module.exports = router;
