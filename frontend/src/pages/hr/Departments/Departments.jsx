import { useState, useEffect } from 'react';
import { notify } from '../../../utils/notify';
import { getAllDepartments, deleteDepartment } from '../../../services/departmentService';
import ConfirmDialog from '../../../components/common/ConfirmDialog';
import DepartmentModal from './DepartmentModal';
import './Departments.css';

function Departments() {
    const [departments, setDepartments] = useState([]);
    const [loading, setLoading] = useState(true);
    const [searchQuery, setSearchQuery] = useState('');
    const [showModal, setShowModal] = useState(false);
    const [editingDepartment, setEditingDepartment] = useState(null);
    const [showDeleteConfirm, setShowDeleteConfirm] = useState(false);
    const [departmentToDelete, setDepartmentToDelete] = useState(null);

    useEffect(() => {
        fetchDepartments();
    }, []);

    const fetchDepartments = async () => {
        try {
            setLoading(true);
            const data = await getAllDepartments();
            setDepartments(data.departments || []);
        } catch (error) {
            notify.error(error.message || 'Failed to fetch departments');
        } finally {
            setLoading(false);
        }
    };

    const handleCreate = () => {
        setEditingDepartment(null);
        setShowModal(true);
    };

    const handleEdit = (department) => {
        setEditingDepartment(department);
        setShowModal(true);
    };

    const handleDelete = (department) => {
        setDepartmentToDelete(department);
        setShowDeleteConfirm(true);
    };

    const confirmDelete = async () => {
        if (!departmentToDelete) return;

        try {
            await deleteDepartment(departmentToDelete.id);
            notify.success('Department deleted successfully');
            fetchDepartments();
        } catch (error) {
            notify.error(error.message || 'Failed to delete department');
        } finally {
            setShowDeleteConfirm(false);
            setDepartmentToDelete(null);
        }
    };

    const cancelDelete = () => {
        setShowDeleteConfirm(false);
        setDepartmentToDelete(null);
    };

    const handleModalClose = (shouldRefresh) => {
        setShowModal(false);
        setEditingDepartment(null);
        if (shouldRefresh) {
            fetchDepartments();
        }
    };

    const filteredDepartments = departments.filter(dept => {
        if (!searchQuery) return true;
        const query = searchQuery.toLowerCase();
        return (
            dept.name.toLowerCase().includes(query) ||
            (dept.description && dept.description.toLowerCase().includes(query)) ||
            (dept.manager_name && dept.manager_name.toLowerCase().includes(query))
        );
    });

    return (
        <div className="departments-wrapper">
            <div className="departments-header">
                <div className="departments-title-section">
                    <h1 className="departments-title">Departments</h1>
                    <p className="departments-subtitle">
                        {departments.length} {departments.length === 1 ? 'department' : 'departments'}
                    </p>
                </div>
                <button className="btn-create-department" onClick={handleCreate}>
                    + Create department
                </button>
            </div>

            <div className="departments-search">
                <div className="search-box">
                    <svg className="search-icon" width="16" height="16" viewBox="0 0 16 16" fill="none">
                        <path d="M7 12.5C10.0376 12.5 12.5 10.0376 12.5 7C12.5 3.96243 10.0376 1.5 7 1.5C3.96243 1.5 1.5 3.96243 1.5 7C1.5 10.0376 3.96243 12.5 7 12.5Z" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"/>
                        <path d="M14.5 14.5L11 11" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"/>
                    </svg>
                    <input
                        type="text"
                        placeholder="Search departments"
                        value={searchQuery}
                        onChange={(e) => setSearchQuery(e.target.value)}
                        className="search-input"
                    />
                </div>
            </div>

            {loading ? (
                <div className="loading-state">Loading departments...</div>
            ) : departments.length === 0 ? (
                <div className="empty-state">
                    <div className="empty-icon">🏢</div>
                    <h3>No departments yet</h3>
                    <p>Create your first department to organize your vacancies</p>
                    <button className="btn-create-department" onClick={handleCreate}>
                        Create department
                    </button>
                </div>
            ) : filteredDepartments.length === 0 ? (
                <div className="empty-state">
                    <div className="empty-icon">🔍</div>
                    <h3>No departments found</h3>
                    <p>Try a different search query</p>
                </div>
            ) : (
                <div className="departments-table-container">
                    <table className="departments-table">
                        <thead>
                            <tr>
                                <th>Department</th>
                                <th>Manager</th>
                                <th>Jobs</th>
                                <th></th>
                            </tr>
                        </thead>
                        <tbody>
                            {filteredDepartments.map(dept => (
                                <tr key={dept.id}>
                                    <td className="department-name-cell">
                                        <div className="department-name">{dept.name}</div>
                                        {dept.description && (
                                            <div className="department-description">{dept.description}</div>
                                        )}
                                    </td>
                                    <td className="department-manager">
                                        {dept.manager_name || 'No manager assigned'}
                                    </td>
                                    <td className="department-jobs-count">
                                        {dept.job_count || 0} {dept.job_count === 1 ? 'job' : 'jobs'}
                                    </td>
                                    <td>
                                        <div className="department-actions">
                                            <button 
                                                className="btn-edit-department"
                                                onClick={() => handleEdit(dept)}
                                            >
                                                Edit
                                            </button>
                                            <button 
                                                className="btn-delete-department"
                                                onClick={() => handleDelete(dept)}
                                            >
                                                Delete
                                            </button>
                                        </div>
                                    </td>
                                </tr>
                            ))}
                        </tbody>
                    </table>
                </div>
            )}

            {showModal && (
                <DepartmentModal 
                    department={editingDepartment}
                    onClose={handleModalClose}
                />
            )}

            <ConfirmDialog
                open={showDeleteConfirm}
                title="Delete department?"
                message={departmentToDelete ? `Are you sure you want to delete "${departmentToDelete.name}"? This action cannot be undone.` : ''}
                confirmLabel="Delete"
                onConfirm={confirmDelete}
                onCancel={cancelDelete}
                isDanger={true}
            />
        </div>
    );
}

export default Departments;
