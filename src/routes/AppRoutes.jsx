import { Navigate, Route, Routes } from 'react-router-dom';
import AuthPage from '../pages/AuthPage.jsx';
import DashboardPage from '../pages/DashboardPage.jsx';
import ProtectedRoute from './ProtectedRoute.jsx';
import { hasAuthToken } from '../services/auth.js';

function RootRedirect() {
    return <Navigate to={hasAuthToken() ? '/app' : '/login'} replace />;
}

export default function AppRoutes() {
    return (
        <Routes>
            <Route path="/" element={<RootRedirect />} />
            <Route path="/login" element={<AuthPage mode="login" />} />
            <Route path="/register" element={<AuthPage mode="register" />} />
            <Route element={<ProtectedRoute />}>
                <Route path="/app" element={<DashboardPage />} />
                <Route path="/app/ledger" element={<DashboardPage />} />
                <Route path="/app/customers" element={<DashboardPage />} />
                <Route path="/app/settings" element={<DashboardPage />} />
            </Route>
            <Route path="*" element={<RootRedirect />} />
        </Routes>
    );
}
