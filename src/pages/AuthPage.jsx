import { useState } from 'react';
import { Navigate, useNavigate } from 'react-router-dom';
import { useDispatch } from 'react-redux';
import Icon from '../components/Icon.jsx';
import { apiRequest } from '../services/api.js';
import { clearAuthSession, hasAuthToken, saveAuthSession } from '../services/auth.js';
import { setAccountMobile } from '../store/appDataSlice.js';

export default function AuthPage({ mode }) {
    const [mobile, setMobile] = useState('');
    const [error, setError] = useState('');
    const [busy, setBusy] = useState(false);
    const navigate = useNavigate();
    const dispatch = useDispatch();
    const registering = mode === 'register';

    if (localStorage.getItem('thandalAuth') && !hasAuthToken()) clearAuthSession();
    if (hasAuthToken()) return <Navigate to="/app" replace />;

    const submit = async (event) => {
        event.preventDefault();
        setError('');
        setBusy(true);
        try {
            const account = await apiRequest(`/auth/${mode}`, {
                method: 'POST',
                body: JSON.stringify({ mobileNumber: mobile }),
            });
            if (!account.token || !account.mobileNumber) {
                throw new Error('The API server is outdated. Restart it from the project folder with npm run server:dev, then try again.');
            }
            saveAuthSession(account);
            dispatch(setAccountMobile(account.mobileNumber));
            navigate('/app', { replace: true });
        } catch (requestError) {
            setError(requestError.message);
        } finally {
            setBusy(false);
        }
    };

    return (
        <main className="access-page">
            <section className="access-panel">
                <div className="access-brand"><span className="access-mark"><Icon name="wallet" /></span><span><strong>Thandal Ledger</strong><small>Collection manager</small></span></div>
                <div className="access-kicker">MOBILE ACCOUNT</div>
                <h1>{registering ? 'Create your account' : 'Welcome back'}</h1>
                <p className="access-intro">{registering ? 'Register with your mobile number to keep your collection records in your own account.' : 'Enter your registered mobile number to open your collection ledger.'}</p>
                <div className="access-tabs" role="tablist" aria-label="Account access">
                    <button type="button" role="tab" aria-selected={!registering} className={!registering ? 'selected' : ''} onClick={() => navigate('/login')}>Log in</button>
                    <button type="button" role="tab" aria-selected={registering} className={registering ? 'selected' : ''} onClick={() => navigate('/register')}>Register</button>
                </div>
                <form className="access-form" onSubmit={submit}>
                    <label className="field"><span>Mobile number</span><input type="tel" inputMode="tel" autoComplete="tel" value={mobile} onChange={(event) => setMobile(event.target.value)} placeholder="e.g. 98765 43210" required minLength="8" maxLength="20" /></label>
                    <small className="access-hint">Indian 10-digit numbers are saved with +91. Other numbers should include country code.</small>
                    {error && <p className="access-error" role="alert">{error}</p>}
                    <button className="primary-button access-submit" type="submit" disabled={busy}>{busy ? 'Please wait…' : registering ? 'Create account' : 'Continue'}</button>
                </form>
                <p className="access-disclaimer">Number-only access does not verify phone ownership. Anyone who knows a registered number can sign in. Add OTP verification before using this with sensitive records.</p>
            </section>
        </main>
    );
}
