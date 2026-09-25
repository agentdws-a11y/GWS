import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';
import { Toaster } from 'sonner';
import { useState, useEffect } from 'react';
import Landing from './pages/Landing/Landing';
import Login from './pages/auth/Login/Login';
import Register from './pages/auth/Register/Register';
import AdminRegister from './pages/auth/AdminRegister/AdminRegister';
import ProtectedRoute from './components/common/ProtectedRoute';

import HRDashboardLayout from './pages/hr/HRDashboardLayout';
import HRDashboard from './pages/hr/Dashboard/Dashboard';
import HRVacancies from './pages/hr/Vacancies/Vacancies';
import VacancyForm from './pages/hr/VacancyForm/VacancyForm';
import HRApplications from './pages/hr/Applications/Applications';
import CandidateDetail from './pages/hr/CandidateDetail/CandidateDetail';
import ScheduleInterview from './pages/hr/ScheduleInterview/ScheduleInterview';
import InterviewReview from './pages/hr/InterviewReview/InterviewReview';
import OfferScreen from './pages/hr/OfferScreen/OfferScreen';
import InterviewFeedback from './pages/hr/InterviewFeedback/InterviewFeedback';
import HRInterviews from './pages/hr/Interviews/Interviews';
import VacancyApplications from './pages/hr/VacancyApplications';
import AssessmentList from './pages/hr/Assessments/AssessmentList';
import AssessmentForm from './pages/hr/Assessments/AssessmentForm';
import AssessmentResults from './pages/hr/Assessments/AssessmentResults';
import Departments from './pages/hr/Departments/Departments';
import AdminInvites from './pages/hr/AdminInvites/AdminInvites';
import Analytics from './pages/hr/Analytics/Analytics';

import CandidateAssessmentList from './pages/candidate/Assessments/AssessmentList';
import TakeAssessment from './pages/candidate/Assessments/TakeAssessment';
import AssessmentResult from './pages/candidate/Assessments/AssessmentResult';

import CandidatePortalLayout from './pages/candidate/CandidatePortalLayout';
import CandidateDashboard from './pages/candidate/Dashboard/Dashboard';
import CandidateVacancies from './pages/candidate/Vacancies/Vacancies';
import CandidateJobDetail from './pages/candidate/JobDetail/JobDetail';
import CandidateApplications from './pages/candidate/Applications/Applications';
import CandidateInterviews from './pages/candidate/Interviews/Interviews';
import CandidateOffers from './pages/candidate/Offers/Offers';

function App() {
    const [theme, setTheme] = useState(() => {
        return localStorage.getItem('theme') || 'dark';
    });

    useEffect(() => {
        const handleThemeChange = () => {
            const currentTheme = document.documentElement.getAttribute('data-theme') || 'dark';
            setTheme(currentTheme);
        };

        handleThemeChange();

        const observer = new MutationObserver(handleThemeChange);
        observer.observe(document.documentElement, {
            attributes: true,
            attributeFilter: ['data-theme']
        });

        return () => observer.disconnect();
    }, []);

    return (
        <BrowserRouter>
            <Toaster 
                theme={theme}
                position="bottom-right"
                toastOptions={{
                    style: {
                        background: 'var(--card-bg)',
                        color: 'var(--text-primary)',
                        border: '1px solid var(--border-subtle)',
                        borderRadius: '12px',
                        padding: '12px 16px',
                        fontSize: '14px',
                        maxWidth: '360px',
                        boxShadow: '0 8px 24px rgba(0, 0, 0, 0.15)',
                    },
                }}
                closeButton
            />
            <Routes>
                <Route path="/" element={<Landing />} />
                <Route path="/login" element={<Login />} />
                <Route path="/register" element={<Register />} />
                <Route path="/admin-register/:token" element={<AdminRegister />} />

                <Route
                    path="/hr"
                    element={
                        <ProtectedRoute allowedRole="HR_ADMIN">
                            <HRDashboardLayout />
                        </ProtectedRoute>
                    }
                >
                    <Route index element={<HRDashboard />} />
                    <Route path="analytics" element={<Analytics />} />
                    <Route path="vacancies" element={<HRVacancies />} />
                    <Route path="vacancies/new" element={<VacancyForm />} />
                    <Route path="vacancies/:jobId/edit" element={<VacancyForm />} />
                    <Route path="vacancies/:jobId/applications" element={<VacancyApplications />} />
                    <Route path="departments" element={<Departments />} />
                    <Route path="admin-invites" element={<AdminInvites />} />
                    <Route path="applications" element={<HRApplications />} />
                    <Route path="applications/:applicationId" element={<CandidateDetail />} />
                    <Route path="applications/:applicationId/schedule" element={<ScheduleInterview />} />
                    <Route path="applications/:applicationId/review" element={<InterviewReview />} />
                    <Route path="applications/:applicationId/offer" element={<OfferScreen />} />
                    <Route path="interviews/:interviewId/feedback" element={<InterviewFeedback />} />
                    <Route path="interviews" element={<HRInterviews />} />
                    <Route path="assessments" element={<AssessmentList />} />
                    <Route path="assessments/new" element={<AssessmentForm />} />
                    <Route path="assessments/:id/edit" element={<AssessmentForm />} />
                    <Route path="assessments/results/:applicationId" element={<AssessmentResults />} />
                </Route>

                <Route
                    path="/candidate"
                    element={
                        <ProtectedRoute allowedRole="CANDIDATE">
                            <CandidatePortalLayout />
                        </ProtectedRoute>
                    }
                >
                    <Route index element={<CandidateDashboard />} />
                    <Route path="jobs" element={<CandidateVacancies />} />
                    <Route path="jobs/:jobId" element={<CandidateJobDetail />} />
                    <Route path="applications" element={<CandidateApplications />} />
                    <Route path="interviews" element={<CandidateInterviews />} />
                    <Route path="offers" element={<CandidateOffers />} />
                    <Route path="assessments" element={<CandidateAssessmentList />} />
                    <Route path="assessments/:assessmentId/take" element={<TakeAssessment />} />
                    <Route path="assessments/:assessmentId/result" element={<AssessmentResult />} />
                </Route>

                <Route path="*" element={<Navigate to="/" replace />} />
            </Routes>
        </BrowserRouter>
    );
}

export default App;