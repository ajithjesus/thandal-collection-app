import { useEffect, useState } from 'react';
import { useDispatch, useSelector } from 'react-redux';
import Icon from '../components/Icon.jsx';
import { addCustomer as addCustomerThunk, loadCustomers } from '../store/appDataSlice.js';

export default function CustomersPage() {
    const dispatch = useDispatch();
    const customers = useSelector((state) => state.appData.customers);
    const [name, setName] = useState('');
    const [mobileNumber, setMobileNumber] = useState('');
    const [loading, setLoading] = useState(true);
    const [busy, setBusy] = useState(false);
    const [error, setError] = useState('');

    useEffect(() => {
        let active = true;
        dispatch(loadCustomers())
            .unwrap()
            .catch((requestError) => { if (active) setError(requestError.message); })
            .finally(() => { if (active) setLoading(false); });
        return () => { active = false; };
    }, [dispatch]);

    const addCustomer = async (event) => {
        event.preventDefault();
        setError('');
        setBusy(true);
        try {
            await dispatch(addCustomerThunk({ name, mobileNumber })).unwrap();
            setName('');
            setMobileNumber('');
        } catch (requestError) {
            setError(requestError.message);
        } finally {
            setBusy(false);
        }
    };

    return (
        <section className="customer-directory">
            <form className="panel directory-form" onSubmit={addCustomer}>
                <div className="panel-heading">
                    <div><h2>Add a customer</h2><p>Enter a name and mobile number.</p></div>
                    <div className="heading-icon"><Icon name="user" /></div>
                </div>
                <div className="directory-fields">
                    <label className="field"><span>Customer name</span><input value={name} onChange={(event) => setName(event.target.value)} maxLength={100} placeholder="e.g. Ramesh Kumar" required /></label>
                    <label className="field"><span>Mobile number</span><input type="tel" inputMode="tel" autoComplete="tel" value={mobileNumber} onChange={(event) => setMobileNumber(event.target.value)} placeholder="e.g. 98765 43210" required /></label>
                    <button className="primary-button directory-submit" type="submit" disabled={busy}><Icon name="plus" />{busy ? 'Adding…' : 'Add customer'}</button>
                </div>
                {error && <p className="directory-error" role="alert">{error}</p>}
            </form>

            <section className="panel directory-list" aria-labelledby="directory-heading">
                <div className="panel-heading"><div><h2 id="directory-heading">Customer list</h2><p>{customers.length} {customers.length === 1 ? 'customer' : 'customers'}</p></div></div>
                {loading ? <p className="directory-state">Loading customers…</p> : customers.length ? (
                    <ul className="customer-list">
                        {customers.map((customer) => <li className="customer-list-row" key={customer._id}><span className="customer-list-avatar"><Icon name="user" /></span><span className="customer-list-details"><strong>{customer.name}</strong><small>{customer.mobileNumber}</small></span></li>)}
                    </ul>
                ) : <div className="directory-state">No customers yet. Add one above.</div>}
            </section>
        </section>
    );
}
