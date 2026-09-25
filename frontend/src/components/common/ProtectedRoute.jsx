import { Navigate } from 'react-router-dom';
import { getToken, getUser } from '../../utils/auth';

function ProtectedRoute({ allowedRole, children }) {
    const token = getToken();
    const user = getUser();

    if (!token || !user) {
        return <Navigate to="/login" replace />;
    }

    if (user.role !== allowedRole) {
        if (user.role === 'HR_ADMIN') {
            return <Navigate to="/hr" replace />;
        }

        if (user.role === 'CANDIDATE') {
            return <Navigate to="/candidate" replace />;
        }

        return <Navigate to="/login" replace />;
    }

    return children;
}

export default ProtectedRoute;