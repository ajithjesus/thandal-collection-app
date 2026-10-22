import { useEffect, useState } from 'react';
import { useDispatch } from 'react-redux';
import { Navigate, Outlet } from 'react-router-dom';
import { apiRequest } from '../services/api.js';
import { clearAuthSession, getAuthSession } from '../services/auth.js';
import { clearAccountData, setAccountMobile } from '../store/appDataSlice.js';

export default function ProtectedRoute() {
    const [sessionState, setSessionState] = useState('checking');
    const dispatch = useDispatch();

    useEffect(() => {
        let active = true;
        let expiryTimer;
        const endSession = () => {
            clearAuthSession();
            dispatch(clearAccountData());
            if (active) setSessionState('expired');
        };
        const validateSession = async () => {
            const storedSession = getAuthSession();
            if (!storedSession?.token) {
                setSessionState('expired');
                return;
            }
            try {
                const session = await apiRequest('/auth/session');
                if (!active) return;
                const remaining = session.expiresAt - Date.now();
                if (remaining <= 0) {
                    endSession();
                    return;
                }
                dispatch(setAccountMobile(session.mobileNumber));
                setSessionState('valid');
                expiryTimer = window.setTimeout(endSession, remaining);
            } catch {
                endSession();
            }
        };
        window.addEventListener('thandal:session-expired', endSession);
        validateSession();
        return () => {
            active = false;
            window.removeEventListener('thandal:session-expired', endSession);
            window.clearTimeout(expiryTimer);
        };
    }, [dispatch]);

    if (sessionState === 'checking') return <main className="access-page"><p>Checking your session…</p></main>;
    return sessionState === 'valid' ? <Outlet /> : <Navigate to="/login" replace />;
}
