import Icon from './Icon.jsx';
import { getPending, getStatus, money } from '../utils/collections.js';

export default function Ledger({ entries, formatDate, onDelete }) {
    if (!entries.length) {
        return <div className="empty-state"><div className="empty-icon"><Icon name="calendar" /></div><strong>No collection entries yet</strong><p>Record a daily collection or monthly payment. Saved entries are stored in MongoDB.</p></div>;
    }

    return <div className="table-wrap"><table className="ledger-table split-ledger-table"><thead><tr><th>Date</th><th>Entry</th><th>Auto / rent</th><th>Loan repayment</th><th>Monthly</th><th>Total pending</th><th>Status</th><th aria-label="Actions" /></tr></thead><tbody>{entries.map((row) => {
        const status = getStatus(row);
        return <tr key={row._id}><td className="date-cell">{formatDate(row.date)}</td><td><div className="collection-name">{row.type === 'monthly' ? 'Monthly payment' : 'Daily collection'}</div>{row.note && <div className="row-note">{row.note}</div>}</td>
            <td>{row.type === 'monthly' ? <span className="muted-cell">—</span> : <><strong>{money(row.autoReceived || 0)}</strong><div className="row-note">of {money(row.autoExpected || 0)}</div></>}</td>
            <td>{row.type === 'monthly' ? <span className="muted-cell">—</span> : <><strong className="received-cell">{money(row.loanReceived || 0)}</strong><div className="row-note">of {money(row.loanExpected || 0)} · principal</div></>}</td>
            <td>{row.type === 'monthly' ? <><strong>{money(row.monthlyReceived || 0)}</strong><div className="row-note">of {money(row.monthlyExpected || 0)}</div></> : <span className="muted-cell">—</span>}</td>
            <td className={getPending(row) > 0 ? 'pending-cell' : 'muted-cell'}>{money(getPending(row))}</td><td><span className={`status-badge ${status.toLowerCase()}`}><span />{status}</span></td><td><button className="delete-button" title="Delete entry" onClick={() => onDelete(row._id)}><Icon name="trash" /></button></td></tr>;
    })}</tbody></table></div>;
}
