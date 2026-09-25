import { useState, useEffect } from 'react';
import { notify } from '../../../utils/notify';
import { createDepartment, updateDepartment, getManagersList } from '../../../services/departmentService';
import './DepartmentModal.css';

function DepartmentModal({ department, onClose }) {
    const isEditing = !!department;

    const [formData, setFormData] = useState({
        name: '',
        description: '',
        manager_id: ''
    });

    const [managers, setManagers] = useState([]);
    const [loading, setLoading] = useState(false);
    const [submitting, setSubmitting] = useState(false);

    useEffect(() => {
        fetchManagers();

        if (department) {
            setFormData({
                name: department.name || '',
                description: department.description || '',
                manager_id: department.manager_id || ''
            });
        }
    }, [department]);

    const fetchManagers = async () => {
        try {
            setLoading(true);
            const data = await getManagersList();
            setManagers(data.managers || []);
        } catch (error) {
            console.error('Failed to fetch managers:', error);
        } finally {
            setLoading(false);
        }
    };

    const handleChange = (e) => {
        const { name, value } = e.target;
        setFormData(prev => ({
            ...prev,
            [name]: value
        }));
    };

    const handleSubmit = async (e) => {
        e.preventDefault();

        if (!formData.name.trim()) {
            notify.error('Department name is required');
            return;
        }

        if (formData.name.trim().length < 2) {
            notify.error('Department name must be at least 2 characters');
            return;
        }

        try {
            setSubmitting(true);

            const dataToSend = {
                name: formData.name.trim(),
                description: formData.description.trim() || null,
                manager_id: formData.manager_id || null
            };

            if (isEditing) {
                await updateDepartment(department.id, dataToSend);
                notify.success('Department updated successfully');
            } else {
                await createDepartment(dataToSend);
                notify.success('Department created successfully');
            }

            onClose(true);
        } catch (error) {
            notify.error(error.message || `Failed to ${isEditing ? 'update' : 'create'} department`);
        } finally {
            setSubmitting(false);
        }
    };

    const handleBackdropClick = (e) => {
        if (e.target === e.currentTarget) {
            onClose(false);
        }
    };

    return (
        <div className="dept-modal-backdrop" onClick={handleBackdropClick}>
            <div className="dept-modal">
                <div className="dept-modal-header">
                    <h2 className="dept-modal-title">
                        {isEditing ? 'Edit department' : 'Create department'}
                    </h2>
                    <button
                        type="button"
                        className="dept-modal-close"
                        onClick={() => onClose(false)}
                        aria-label="Close"
                    >
                        ×
                    </button>
                </div>

                <form onSubmit={handleSubmit}>
                    <div className="dept-modal-body">
                        <div className="dept-form-group">
                            <label className="dept-form-label">
                                Department name
                            </label>
                            <input
                                type="text"
                                name="name"
                                value={formData.name}
                                onChange={handleChange}
                                placeholder="Engineering"
                                className="dept-form-input"
                                required
                                autoFocus
                            />
                        </div>

                        <div className="dept-form-group">
                            <label className="dept-form-label">
                                Description
                                <span className="dept-form-label-optional">(optional)</span>
                            </label>
                            <textarea
                                name="description"
                                value={formData.description}
                                onChange={handleChange}
                                placeholder="Brief description of the department"
                                className="dept-form-textarea"
                            />
                        </div>

                        <div className="dept-form-group">
                            <label className="dept-form-label">
                                Manager
                                <span className="dept-form-label-optional">(optional)</span>
                            </label>
                            <select
                                name="manager_id"
                                value={formData.manager_id}
                                onChange={handleChange}
                                className="dept-form-select"
                                disabled={loading}
                            >
                                <option value="">No manager assigned</option>
                                {managers.map(manager => (
                                    <option key={manager.id} value={manager.id}>
                                        {manager.name} ({manager.email})
                                    </option>
                                ))}
                            </select>
                            <p className="dept-form-helper">
                                Manager must be an HR admin user
                            </p>
                        </div>
                    </div>

                    <div className="dept-modal-footer">
                        <button
                            type="button"
                            className="dept-btn-cancel"
                            onClick={() => onClose(false)}
                            disabled={submitting}
                        >
                            Cancel
                        </button>
                        <button
                            type="submit"
                            className="dept-btn-save"
                            disabled={submitting}
                        >
                            {submitting ? 'Saving...' : isEditing ? 'Save changes' : 'Create department'}
                        </button>
                    </div>
                </form>
            </div>
        </div>
    );
}

export default DepartmentModal;
