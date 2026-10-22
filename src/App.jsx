import { useEffect, useMemo, useState } from 'react';
import { useDispatch, useSelector } from 'react-redux';
import { useLocation, useNavigate } from 'react-router-dom';
import Icon from './components/Icon.jsx';
import Ledger from './components/Ledger.jsx';
import MetricCard from './components/MetricCard.jsx';
import CustomersPage from './pages/CustomersPage.jsx';
import { clearAuthSession } from './services/auth.js';
import { clearAccountData } from './store/appDataSlice.js';
import {
  deleteEntry as deleteEntryThunk,
  loadDashboardData,
  saveEntry as saveEntryThunk,
  saveSettings as saveSettingsThunk,
  sendCollectionMessage as sendCollectionMessageThunk,
  updateSettingDraft,
} from './store/appDataSlice.js';
import { getExpected, getPending, getReceived, money, today } from './utils/collections.js';

function App() {
  const location = useLocation();
  const navigate = useNavigate();
  const dispatch = useDispatch();
  const activeTab = location.pathname.endsWith('/ledger') ? 'ledger' : location.pathname.endsWith('/settings') ? 'settings' : location.pathname.endsWith('/customers') ? 'customers' : 'overview';
  const { settings, entries } = useSelector((state) => state.appData);
  const [settingsDirty, setSettingsDirty] = useState(false);
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const [dbStatus, setDbStatus] = useState('connecting');
  const [loading, setLoading] = useState(true);
  const [form, setForm] = useState({
    date: today(),
    type: 'daily',
    autoExpected: 320,
    autoReceived: 320,
    loanExpected: 700,
    loanReceived: 700,
    monthlyExpected: 15000,
    monthlyReceived: 15000,
    note: '',
  });
  const [notice, setNotice] = useState('');
  const [messageEntryId, setMessageEntryId] = useState('');

  useEffect(() => {
    let alive = true;
    const load = async () => {
      try {
        const { health, settings: nextSettings } = await dispatch(loadDashboardData()).unwrap();
        if (!alive) return;
        setDbStatus(health.database === 'connected' ? 'connected' : 'disconnected');
        setForm((current) => ({
          ...current,
          autoExpected: nextSettings.autoDailyAmount,
          autoReceived: nextSettings.autoDailyAmount,
          loanExpected: nextSettings.loanDailyAmount,
          loanReceived: nextSettings.loanDailyAmount,
          monthlyExpected: nextSettings.monthlyAmount,
          monthlyReceived: nextSettings.monthlyAmount,
        }));
      } catch (error) {
        if (alive) {
          setDbStatus('disconnected');
          setNotice(`Cannot connect to the database API. Start the Node server and check MongoDB. ${error.message}`);
        }
      } finally {
        if (alive) setLoading(false);
      }
    };
    load();
    return () => { alive = false; };
  }, [dispatch]);

  const logout = () => {
    clearAuthSession();
    dispatch(clearAccountData());
    navigate('/login', { replace: true });
  };

  useEffect(() => {
    if (!notice) return undefined;
    const timer = setTimeout(() => setNotice(''), 5200);
    return () => clearTimeout(timer);
  }, [notice]);

  useEffect(() => {
    if (!sidebarOpen) return undefined;
    const closeOnEscape = (event) => {
      if (event.key === 'Escape') setSidebarOpen(false);
    };
    window.addEventListener('keydown', closeOnEscape);
    return () => window.removeEventListener('keydown', closeOnEscape);
  }, [sidebarOpen]);

  const navigateTo = (path) => {
    navigate(path);
    setSidebarOpen(false);
  };

  const totals = useMemo(() => {
    const dailyEntries = entries.filter((row) => row.type === 'daily');
    const monthlyEntries = entries.filter((row) => row.type === 'monthly');
    const autoReceived = dailyEntries.reduce((sum, row) => sum + Number(row.autoReceived || 0), 0);
    const autoPending = dailyEntries.reduce((sum, row) => sum + Math.max(0, Number(row.autoExpected || 0) - Number(row.autoReceived || 0)), 0);
    const loanReceived = dailyEntries.reduce((sum, row) => sum + Number(row.loanReceived || 0), 0);
    const loanPending = dailyEntries.reduce((sum, row) => sum + Math.max(0, Number(row.loanExpected || 0) - Number(row.loanReceived || 0)), 0);
    const monthlyReceived = monthlyEntries.reduce((sum, row) => sum + Number(row.monthlyReceived || 0), 0);
    const monthlyPending = monthlyEntries.reduce((sum, row) => sum + Math.max(0, Number(row.monthlyExpected || 0) - Number(row.monthlyReceived || 0)), 0);
    const todayRows = entries.filter((row) => row.date === today());
    const todayReceived = todayRows.reduce((sum, row) => sum + getReceived(row), 0);
    const todayPending = todayRows.reduce((sum, row) => sum + getPending(row), 0);
    return {
      autoReceived,
      autoPending,
      loanReceived,
      loanPending,
      monthlyReceived,
      monthlyPending,
      totalReceived: autoReceived + loanReceived + monthlyReceived,
      pending: autoPending + loanPending + monthlyPending,
      principalRepaid: loanReceived,
      remaining: Math.max(0, Number(settings.loanAmount || 0) - loanReceived),
      todayReceived,
      todayPending,
      entriesCount: entries.length,
    };
  }, [entries, settings.loanAmount]);

  const selectedPending = form.type === 'monthly'
    ? Math.max(0, Number(form.monthlyExpected || 0) - Number(form.monthlyReceived || 0))
    : Math.max(0, Number(form.autoExpected || 0) - Number(form.autoReceived || 0))
    + Math.max(0, Number(form.loanExpected || 0) - Number(form.loanReceived || 0));

  const dailyTotal = Number(settings.autoDailyAmount || 0) + Number(settings.loanDailyAmount || 0);

  const updateSetting = (key, value) => {
    const numericKeys = ['loanAmount', 'autoDailyAmount', 'loanDailyAmount', 'monthlyAmount'];
    dispatch(updateSettingDraft({ [key]: numericKeys.includes(key) ? Math.max(0, Number(value) || 0) : value }));
    setSettingsDirty(true);
    if (key === 'autoDailyAmount') setForm((current) => ({ ...current, autoExpected: Number(value) || 0 }));
    if (key === 'loanDailyAmount') setForm((current) => ({ ...current, loanExpected: Number(value) || 0 }));
    if (key === 'monthlyAmount') setForm((current) => ({ ...current, monthlyExpected: Number(value) || 0 }));
  };

  const saveSettings = async (event) => {
    event?.preventDefault?.();
    try {
      await dispatch(saveSettingsThunk(settings)).unwrap();
      setSettingsDirty(false);
      setDbStatus('connected');
      setNotice('Customer and payment settings saved to MongoDB.');
    } catch (error) {
      setNotice(`Settings were not saved: ${error.message}`);
    }
  };

  const changeType = (type) => {
    setForm((current) => type === 'monthly'
      ? { ...current, type, monthlyExpected: settings.monthlyAmount, monthlyReceived: settings.monthlyAmount }
      : { ...current, type, autoExpected: settings.autoDailyAmount, autoReceived: settings.autoDailyAmount, loanExpected: settings.loanDailyAmount, loanReceived: settings.loanDailyAmount });
  };

  const saveEntry = async (event) => {
    event.preventDefault();
    if (!form.date) {
      setNotice('Please select a collection date.');
      return;
    }
    let payload;
    if (form.type === 'monthly') {
      const expected = Math.max(0, Number(form.monthlyExpected) || 0);
      const received = Math.max(0, Number(form.monthlyReceived) || 0);
      if (expected <= 0) return setNotice('Enter the expected monthly payment.');
      if (received > expected) return setNotice('Monthly received amount cannot exceed the expected amount.');
      payload = { date: form.date, type: 'monthly', monthlyExpected: expected, monthlyReceived: received, note: form.note.trim() };
    } else {
      const autoExpected = Math.max(0, Number(form.autoExpected) || 0);
      const autoReceived = Math.max(0, Number(form.autoReceived) || 0);
      const loanExpected = Math.max(0, Number(form.loanExpected) || 0);
      const loanReceived = Math.max(0, Number(form.loanReceived) || 0);
      if (autoReceived > autoExpected) return setNotice('Auto/rent received amount cannot exceed its expected amount.');
      if (loanReceived > loanExpected) return setNotice('Loan repayment received amount cannot exceed its expected amount.');
      if (autoExpected + loanExpected <= 0) return setNotice('Enter an expected collection amount greater than ₹0.');
      payload = { date: form.date, type: 'daily', autoExpected, autoReceived, loanExpected, loanReceived, note: form.note.trim() };
    }
    try {
      const saved = await dispatch(saveEntryThunk(payload)).unwrap();
      setMessageEntryId(saved._id);
      setDbStatus('connected');
      setForm((current) => ({
        ...current,
        date: today(),
        autoExpected: settings.autoDailyAmount,
        autoReceived: settings.autoDailyAmount,
        loanExpected: settings.loanDailyAmount,
        loanReceived: settings.loanDailyAmount,
        monthlyExpected: settings.monthlyAmount,
        monthlyReceived: settings.monthlyAmount,
        note: '',
      }));
      const pending = getPending(saved);
      let noticeText = pending === 0 ? 'Collection entry saved to MongoDB.' : `${saved.type === 'monthly' ? 'Monthly payment' : 'Daily collection'} saved. ${money(pending)} remains pending.`;
      if (saved.date === today() && settings.whatsappOptIn) {
        try {
          await dispatch(sendCollectionMessageThunk(saved._id)).unwrap();
          noticeText += ' WhatsApp message sent.';
        } catch (messageError) {
          noticeText += ` WhatsApp message was not sent: ${messageError.message}`;
        }
      }
      setNotice(noticeText);
    } catch (error) {
      setNotice(`Collection was not saved: ${error.message}`);
    }
  };

  const deleteEntry = async (id) => {
    if (!window.confirm('Delete this collection entry? The loan balance will be recalculated.')) return;
    try {
      await dispatch(deleteEntryThunk(id)).unwrap();
      if (messageEntryId === id) setMessageEntryId('');
      setNotice('Collection entry deleted from MongoDB. Loan balance recalculated.');
    } catch (error) {
      setNotice(`Could not delete entry: ${error.message}`);
    }
  };

  const activeMessageEntry = entries.find((row) => row._id === messageEntryId);
  const reminderMessage = useMemo(() => {
    const recipient = settings.customerName.trim() || 'Sir/Madam';
    const balanceAfterLoanPayments = totals.remaining;
    if (activeMessageEntry?.type === 'daily') {
      const row = activeMessageEntry;
      const autoPending = Math.max(0, Number(row.autoExpected || 0) - Number(row.autoReceived || 0));
      const loanPending = Math.max(0, Number(row.loanExpected || 0) - Number(row.loanReceived || 0));
      const dateText = new Date(`${row.date}T00:00:00`).toLocaleDateString('en-IN', { day: '2-digit', month: 'short', year: 'numeric' });
      return `Vanakkam ${recipient},\n\nDaily collection details for ${dateText}:\n\nAuto / rent collection\n• Expected: ${money(row.autoExpected)}\n• Received: ${money(row.autoReceived)}\n• Pending: ${money(autoPending)}\n\nDaily loan repayment\n• Expected: ${money(row.loanExpected)}\n• Received: ${money(row.loanReceived)}\n• Pending: ${money(loanPending)}\n\nTotal expected: ${money(getExpected(row))}\nTotal received: ${money(getReceived(row))}\nTotal pending: ${money(getPending(row))}\nOutstanding loan balance: ${money(balanceAfterLoanPayments)}\n\nPlease settle the pending amount when possible. Auto/rent collection is recorded separately; only the daily loan repayment amount received is deducted from the loan balance. Thank you.`;
    }
    if (activeMessageEntry?.type === 'monthly') {
      const row = activeMessageEntry;
      const monthlyPending = Math.max(0, Number(row.monthlyExpected || 0) - Number(row.monthlyReceived || 0));
      const dateText = new Date(`${row.date}T00:00:00`).toLocaleDateString('en-IN', { day: '2-digit', month: 'short', year: 'numeric' });
      return `Vanakkam ${recipient},\n\nMonthly payment update for ${dateText}:\n• Expected: ${money(row.monthlyExpected)}\n• Received: ${money(row.monthlyReceived)}\n• Pending: ${money(monthlyPending)}\n\nOutstanding loan balance: ${money(balanceAfterLoanPayments)}\n\nPlease settle the pending monthly payment when possible. This monthly payment is recorded separately and is not deducted from the loan principal. Thank you.`;
    }
    return `Vanakkam ${recipient},\n\nCollection summary:\n• Daily auto / rent amount: ${money(settings.autoDailyAmount)}\n• Daily loan repayment: ${money(settings.loanDailyAmount)}\n• Total daily collection target: ${money(dailyTotal)}\n• Monthly payment (recorded separately): ${money(settings.monthlyAmount)}\n• Total pending collections: ${money(totals.pending)}\n• Outstanding loan balance: ${money(balanceAfterLoanPayments)}\n\nPlease settle pending collection amounts when possible. Only daily loan repayments actually received reduce the loan balance; auto/rent and monthly payments are tracked separately. Thank you.`;
  }, [settings, dailyTotal, totals.pending, totals.remaining, activeMessageEntry]);

  const openWhatsApp = () => {
    const digits = String(settings.phone || '').replace(/\D/g, '');
    if (!digits) {
      setNotice('Add the customer WhatsApp number in Customer & amounts first.');
      return;
    }
    const url = `https://wa.me/${digits}?text=${encodeURIComponent(reminderMessage)}`;
    window.open(url, '_blank', 'noopener,noreferrer');
  };

  const copyMessage = async () => {
    try {
      await navigator.clipboard.writeText(reminderMessage);
      setNotice('Message copied. Paste it into WhatsApp or SMS.');
    } catch {
      setNotice('Copy was blocked by the browser. Select the message text and copy it manually.');
    }
  };

  const exportBackup = () => {
    const backup = { app: 'Thandal Ledger', exportedAt: new Date().toISOString(), settings, entries };
    const blob = new Blob([JSON.stringify(backup, null, 2)], { type: 'application/json' });
    const link = document.createElement('a');
    link.href = URL.createObjectURL(blob);
    link.download = `thandal-ledger-backup-${today()}.json`;
    link.click();
    URL.revokeObjectURL(link.href);
    setNotice('JSON backup downloaded. MongoDB remains the primary data store.');
  };

  const exportCsv = () => {
    const headers = ['Date', 'Type', 'Auto/Rent Expected', 'Auto/Rent Received', 'Loan Repayment Expected', 'Loan Repayment Received', 'Monthly Expected', 'Monthly Received', 'Total Pending', 'Note'];
    const rows = entries.map((row) => [row.date, row.type, row.autoExpected || 0, row.autoReceived || 0, row.loanExpected || 0, row.loanReceived || 0, row.monthlyExpected || 0, row.monthlyReceived || 0, getPending(row), row.note || '']);
    const escapeCsv = (value) => `"${String(value ?? '').replaceAll('"', '""')}"`;
    const csv = [headers, ...rows].map((row) => row.map(escapeCsv).join(',')).join('\n');
    const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
    const link = document.createElement('a');
    link.href = URL.createObjectURL(blob);
    link.download = `thandal-collections-${today()}.csv`;
    link.click();
    URL.revokeObjectURL(link.href);
    setNotice('Collection ledger exported as CSV.');
  };

  const formatDate = (date) => new Date(`${date}T00:00:00`).toLocaleDateString('en-IN', { day: '2-digit', month: 'short', year: 'numeric' });

  return (
    <div className="app-shell">
      {sidebarOpen && <button className="sidebar-backdrop" aria-label="Close navigation menu" onClick={() => setSidebarOpen(false)} />}
      <aside className={`sidebar ${sidebarOpen ? 'sidebar-open' : ''}`} aria-label="Main navigation">
        <div className="brand">
          <div className="brand-mark"><Icon name="wallet" /></div>
          <div><div className="brand-title">Thandal Ledger</div><div className="brand-subtitle">Collection manager</div></div>
          <button className="sidebar-close" type="button" aria-label="Close navigation menu" title="Close menu" onClick={() => setSidebarOpen(false)}><Icon name="close" /></button>
        </div>
        <div className="side-label">WORKSPACE</div>
        <button className={`nav-item ${activeTab === 'overview' ? 'active' : ''}`} onClick={() => navigateTo('/app')}><span className="nav-icon"><Icon name="trend" /></span>Overview</button>
        <button className={`nav-item ${activeTab === 'ledger' ? 'active' : ''}`} onClick={() => navigateTo('/app/ledger')}><span className="nav-icon"><Icon name="calendar" /></span>Collection ledger<span className="nav-count">{entries.length}</span></button>
        <button className={`nav-item ${activeTab === 'customers' ? 'active' : ''}`} onClick={() => navigateTo('/app/customers')}><span className="nav-icon"><Icon name="user" /></span>Customer list</button>
        <button className={`nav-item ${activeTab === 'settings' ? 'active' : ''}`} onClick={() => navigateTo('/app/settings')}><span className="nav-icon"><Icon name="user" /></span>Customer & amounts</button>
        <div className="sidebar-bottom">
          <div className={`secure-icon ${dbStatus === 'connected' ? 'connected-icon' : 'offline-icon'}`}><Icon name={dbStatus === 'connected' ? 'database' : 'clock'} /></div>
          <div className="secure-title">{dbStatus === 'connected' ? 'MongoDB connected' : dbStatus === 'connecting' ? 'Connecting to database' : 'Database not connected'}</div>
          <div className="secure-text">{dbStatus === 'connected' ? 'Customer settings and collections are stored in MongoDB.' : 'Start the Node API and make sure MongoDB is running.'}</div>
          <button className="side-export" onClick={exportBackup}><Icon name="download" /> Export backup</button>
        </div>
      </aside>

      <main className="main-content">
        <header className="topbar">
          <button className="mobile-menu-toggle" type="button" aria-label={sidebarOpen ? 'Close navigation menu' : 'Open navigation menu'} aria-expanded={sidebarOpen} onClick={() => setSidebarOpen((open) => !open)}><Icon name={sidebarOpen ? 'close' : 'menu'} /></button>
          <div className="topbar-title"><div className="eyebrow">COLLECTION WORKSPACE</div><div className="title-row"><h1>{activeTab === 'overview' ? 'Overview' : activeTab === 'ledger' ? 'Collection ledger' : activeTab === 'customers' ? 'Customer list' : 'Customer & payment settings'}</h1></div><p className="topbar-subtitle">Track auto/rent separately from loan repayment. Only money received toward the daily loan repayment reduces principal.</p></div>
          <div className="topbar-right"><div className="today-pill"><Icon name="calendar" />{new Date().toLocaleDateString('en-IN', { weekday: 'short', day: '2-digit', month: 'short', year: 'numeric' })}</div><div className="avatar">{(settings.customerName.trim()[0] || 'C').toUpperCase()}</div><button className="account-logout" onClick={logout}>Log out</button></div>
        </header>

        {loading ? <div className="panel loading-panel"><div className="loading-spinner" /><strong>Loading customer and collection records…</strong><p>Connecting to the Node.js API and MongoDB.</p></div> : null}

        {!loading && activeTab === 'settings' ? (
          <section className="settings-layout">
            <form className="panel settings-panel" onSubmit={saveSettings}>
              <div className="panel-heading"><div><h2>Customer details</h2><p>Enter the borrower's name and WhatsApp number.</p></div><div className="heading-icon"><Icon name="user" /></div></div>
              <div className="settings-grid">
                <label className="field"><span>Customer name</span><input value={settings.customerName} onChange={(e) => updateSetting('customerName', e.target.value)} placeholder="e.g. Ramesh Kumar" /></label>
                <label className="field"><span>WhatsApp number</span><input value={settings.phone} onChange={(e) => updateSetting('phone', e.target.value)} placeholder="Country code + number, e.g. 919876543210" /><small>Use country code for best results (91 for India).</small></label>
                <label className="consent-field"><input type="checkbox" checked={settings.whatsappOptIn} onChange={(e) => updateSetting('whatsappOptIn', e.target.checked)} /><span>The customer agreed to receive WhatsApp collection updates automatically.</span></label>
              </div>
              <div className="settings-actions"><span className="fine-print">{settingsDirty ? 'Unsaved changes' : 'Settings saved'}</span><button className="primary-button" type="submit"><Icon name="check" /> Save settings to database</button></div>
            </form>
            <form className="panel settings-panel" onSubmit={saveSettings}>
              <div className="panel-heading"><div><h2>Loan and collection amounts</h2><p>Change the default amounts used for new entries.</p></div><div className="heading-icon"><Icon name="wallet" /></div></div>
              <div className="settings-grid amount-grid">
                <label className="field"><span>Original borrowed principal (₹)</span><input type="number" min="0" step="1" value={settings.loanAmount} onChange={(e) => updateSetting('loanAmount', e.target.value)} /></label>
                <label className="field"><span>Daily auto / rent collection (₹)</span><input type="number" min="0" step="1" value={settings.autoDailyAmount} onChange={(e) => updateSetting('autoDailyAmount', e.target.value)} /></label>
                <label className="field"><span>Daily loan repayment (₹)</span><input type="number" min="0" step="1" value={settings.loanDailyAmount} onChange={(e) => updateSetting('loanDailyAmount', e.target.value)} /></label>
                <label className="field"><span>Monthly payment (₹)</span><input type="number" min="0" step="1" value={settings.monthlyAmount} onChange={(e) => updateSetting('monthlyAmount', e.target.value)} /></label>
              </div>
              <div className="settings-summary"><div><span>Total daily target</span><strong>{money(dailyTotal)}</strong></div><div><span>Loan repayment recorded</span><strong>{money(totals.principalRepaid)}</strong></div><div><span>Outstanding principal</span><strong>{money(totals.remaining)}</strong></div></div>
              <div className="settings-actions"><p className="fine-print">Only received daily loan repayments reduce principal. Auto/rent and monthly payments are tracked separately.</p><button className="primary-button" type="submit"><Icon name="check" /> Save amounts to database</button></div>
            </form>
            <div className="panel danger-note"><div className="note-symbol">i</div><div><strong>How the balance is calculated</strong><p>Starting principal: {money(settings.loanAmount)}. The app subtracts the amount actually received under “Daily loan repayment” only. For example, if ₹320 auto/rent and ₹700 loan repayment are due but only ₹320 is received, the ₹320 is recorded as auto/rent collection and the loan balance does not decrease.</p></div></div>
          </section>
        ) : null}

        {!loading && activeTab === 'ledger' ? (
          <section className="panel ledger-panel full-ledger"><div className="panel-heading ledger-heading"><div><h2>All collection activity</h2><p>Daily and monthly entries, stored in MongoDB.</p></div><button className="secondary-button" onClick={exportCsv}><Icon name="download" /> Export CSV</button></div><Ledger entries={entries} formatDate={formatDate} onDelete={deleteEntry} /></section>
        ) : null}

        {!loading && activeTab === 'customers' ? <CustomersPage /> : null}

        {!loading && activeTab === 'overview' ? (
          <>
            <section className="metrics-grid">
              <MetricCard title="Outstanding loan balance" value={money(totals.remaining)} subtitle={`Original principal ${money(settings.loanAmount)}`} icon="wallet" tone="blue" />
              <MetricCard title="Loan repaid" value={money(totals.principalRepaid)} subtitle="Daily loan repayment received only" icon="check" tone="green" />
              <MetricCard title="Pending collections" value={money(totals.pending)} subtitle={`Auto/rent ${money(totals.autoPending)} · loan ${money(totals.loanPending)}`} icon="clock" tone="orange" />
              <MetricCard title="Received today" value={money(totals.todayReceived)} subtitle={totals.todayPending ? `${money(totals.todayPending)} pending today` : 'Across entries dated today'} icon="calendar" tone="purple" />
            </section>

            <section className="main-grid">
              <div className="panel entry-panel">
                <div className="panel-heading"><div><h2>Add a collection entry</h2><p>Record the daily amounts separately. Auto/rent does not reduce the loan balance.</p></div><div className="heading-icon plus-icon"><Icon name="plus" /></div></div>
                <form onSubmit={saveEntry} className="collection-form">
                  <div className="form-row two-cols">
                    <label className="field"><span>Collection date</span><input type="date" value={form.date} onChange={(e) => setForm({ ...form, date: e.target.value })} required /></label>
                    <label className="field"><span>Entry type</span><select value={form.type} onChange={(e) => changeType(e.target.value)}><option value="daily">Daily collection (₹320 + ₹700)</option><option value="monthly">Monthly payment</option></select></label>
                  </div>
                  {form.type === 'daily' ? (
                    <>
                      <div className="collection-split-grid">
                        <div className="collection-split-card rent-card">
                          <div className="split-title"><span className="split-indicator rent-indicator" /><div><strong>Auto / rent collection</strong><small>Tracked separately · does not reduce loan</small></div></div>
                          <label className="field"><span>Expected (₹)</span><input type="number" min="0" step="1" value={form.autoExpected} onChange={(e) => setForm({ ...form, autoExpected: e.target.value })} required /></label>
                          <label className="field"><span>Received (₹)</span><input type="number" min="0" step="1" value={form.autoReceived} onChange={(e) => setForm({ ...form, autoReceived: e.target.value })} required /></label>
                          <div className="split-pending">Pending <strong>{money(Math.max(0, Number(form.autoExpected || 0) - Number(form.autoReceived || 0)))}</strong></div>
                        </div>
                        <div className="collection-split-card loan-card">
                          <div className="split-title"><span className="split-indicator loan-indicator" /><div><strong>Daily loan repayment</strong><small>Only the received amount reduces loan</small></div></div>
                          <label className="field"><span>Expected (₹)</span><input type="number" min="0" step="1" value={form.loanExpected} onChange={(e) => setForm({ ...form, loanExpected: e.target.value })} required /></label>
                          <label className="field"><span>Received (₹)</span><input type="number" min="0" step="1" value={form.loanReceived} onChange={(e) => setForm({ ...form, loanReceived: e.target.value })} required /></label>
                          <div className="split-pending">Pending <strong>{money(Math.max(0, Number(form.loanExpected || 0) - Number(form.loanReceived || 0)))}</strong></div>
                        </div>
                      </div>
                      <div className="loan-impact-note"><Icon name="wallet" /><span><small>Loan balance reduction for this entry</small><strong>{money(Number(form.loanReceived || 0))}</strong><small>Auto/rent received: {money(Number(form.autoReceived || 0))} — not deducted from principal.</small></span></div>
                    </>
                  ) : (
                    <div className="collection-split-card monthly-card">
                      <div className="split-title"><span className="split-indicator monthly-indicator" /><div><strong>Monthly payment</strong><small>Tracked separately · does not reduce principal</small></div></div>
                      <div className="form-row two-cols">
                        <label className="field"><span>Expected monthly payment (₹)</span><input type="number" min="0" step="1" value={form.monthlyExpected} onChange={(e) => setForm({ ...form, monthlyExpected: e.target.value })} required /></label>
                        <label className="field"><span>Amount received (₹)</span><input type="number" min="0" step="1" value={form.monthlyReceived} onChange={(e) => setForm({ ...form, monthlyReceived: e.target.value })} required /></label>
                      </div>
                    </div>
                  )}
                  <label className="field"><span>Note (optional)</span><input value={form.note} onChange={(e) => setForm({ ...form, note: e.target.value })} placeholder="e.g. Paid partly; balance expected tomorrow" /></label>
                  <div className={`entry-preview ${selectedPending > 0 ? 'is-pending' : 'is-paid'}`}>
                    <div><span>{form.type === 'monthly' ? 'Monthly payment pending' : 'Total daily collection pending'}</span><strong>{money(selectedPending)}</strong></div>
                    <div className="preview-status"><span className={`status-dot ${selectedPending > 0 ? 'orange' : 'green'}`} />{selectedPending > 0 ? (getReceived({ type: form.type, autoReceived: form.autoReceived, loanReceived: form.loanReceived, monthlyReceived: form.monthlyReceived }) === 0 ? 'Not collected' : 'Partially collected') : 'Fully collected'}</div>
                  </div>
                  <button className="primary-button full-button" type="submit"><Icon name="plus" /> Save {form.type === 'monthly' ? 'monthly payment' : 'daily entry'} to database</button>
                </form>
              </div>

              <div className="right-column">
                <div className="panel customer-panel">
                  <div className="customer-panel-top"><div className="customer-avatar"><Icon name="user" /></div><div className="customer-info"><span className="mini-label">CURRENT CUSTOMER</span><h2>{settings.customerName.trim() || 'Customer name not set'}</h2><p>{settings.phone.trim() || 'Add a WhatsApp number in settings'}</p></div><button className="icon-button" title="Edit customer details" onClick={() => navigateTo('/app/settings')}>Edit</button></div>
                  <div className="customer-detail-row"><span>Auto / rent each day</span><strong>{money(settings.autoDailyAmount)}</strong></div>
                  <div className="customer-detail-row"><span>Loan repayment each day</span><strong>{money(settings.loanDailyAmount)}</strong></div>
                  <div className="customer-detail-row"><span>Total daily target</span><strong>{money(dailyTotal)}</strong></div>
                  <div className="customer-detail-row"><span>Monthly payment</span><strong>{money(settings.monthlyAmount)}</strong></div>
                  <div className="customer-detail-row"><span>Outstanding loan</span><strong>{money(totals.remaining)}</strong></div>
                  <button className="whatsapp-button" onClick={openWhatsApp}><Icon name="message" /> Open WhatsApp message <span>↗</span></button>
                </div>
                <div className="panel message-panel">
                  <div className="panel-heading compact-heading"><div><h2>Customer message</h2><p>{activeMessageEntry ? 'Latest saved entry is included.' : 'General pending collection summary.'}</p></div><div className="whatsapp-mini">WA</div></div>
                  <textarea className="message-preview" readOnly value={reminderMessage} rows={10} aria-label="WhatsApp message preview" />
                  <button className="secondary-button full-button" onClick={copyMessage}>Copy message</button>
                  <p className="fine-print message-note">WhatsApp opens in a new tab. Review the message and press Send yourself.</p>
                </div>
              </div>
            </section>

            <section className="panel ledger-panel">
              <div className="panel-heading ledger-heading"><div><h2>Recent collection activity</h2><p>Daily amounts, monthly payments, and pending balances.</p></div><div className="ledger-actions"><button className="secondary-button" onClick={exportCsv}><Icon name="download" /> Export CSV</button><button className="text-button" onClick={() => navigateTo('/app/ledger')}>View all activity <span>→</span></button></div></div>
              <Ledger entries={entries.slice(0, 6)} formatDate={formatDate} onDelete={deleteEntry} />
            </section>
          </>
        ) : null}

        <footer className="footer"><span>Thandal Ledger <span className="footer-dot">•</span> Personal collection tracker</span><span>{dbStatus === 'connected' ? 'Records stored in MongoDB' : 'MongoDB connection is not ready'}</span></footer>
      </main>
      {notice && <div className="toast" role="status"><span className="toast-check">✓</span>{notice}</div>}
    </div>
  );
}

export default App;
