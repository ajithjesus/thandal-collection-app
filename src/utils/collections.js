export const DEFAULT_SETTINGS = {
    customerName: '',
    phone: '',
    whatsappOptIn: false,
    loanAmount: 800000,
    autoDailyAmount: 320,
    loanDailyAmount: 700,
    monthlyAmount: 15000,
};

export const today = () => {
    const now = new Date();
    const local = new Date(now.getTime() - now.getTimezoneOffset() * 60000);
    return local.toISOString().slice(0, 10);
};

export const money = (value) => new Intl.NumberFormat('en-IN', {
    style: 'currency', currency: 'INR', maximumFractionDigits: 0,
}).format(Number(value || 0));

export const getReceived = (row) => row.type === 'monthly'
    ? Number(row.monthlyReceived || 0)
    : Number(row.autoReceived || 0) + Number(row.loanReceived || 0);

export const getExpected = (row) => row.type === 'monthly'
    ? Number(row.monthlyExpected || 0)
    : Number(row.autoExpected || 0) + Number(row.loanExpected || 0);

export const getPending = (row) => Math.max(0, getExpected(row) - getReceived(row));

export const getStatus = (row) => {
    const pending = getPending(row);
    if (pending <= 0) return 'Paid';
    return getReceived(row) <= 0 ? 'Missed' : 'Partial';
};
