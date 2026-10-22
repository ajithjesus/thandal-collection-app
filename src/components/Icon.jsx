export default function Icon({ name }) {
    const paths = {
        wallet: <><rect x="3" y="6" width="18" height="14" rx="2" /><path d="M3 9V5a2 2 0 0 1 2-2h13" /><path d="M16 13h5" /><circle cx="16" cy="13" r=".8" /></>,
        calendar: <><rect x="3" y="5" width="18" height="16" rx="2" /><path d="M16 3v4M8 3v4M3 10h18" /></>,
        check: <path d="m5 12 4 4L19 6" />,
        clock: <><circle cx="12" cy="12" r="9" /><path d="M12 7v5l3 2" /></>,
        message: <path d="M21 11.5a8.5 8.5 0 0 1-12.4 7.6L3 21l1.9-5.1A8.5 8.5 0 1 1 21 11.5Z" />,
        download: <><path d="M12 3v12m-5-5 5 5 5-5" /><path d="M5 19h14" /></>,
        plus: <path d="M12 5v14M5 12h14" />,
        trash: <path d="M3 6h18M8 6V4h8v2m-9 0 1 14h8l1-14M10 10v6m4-6v6" />,
        trend: <><path d="m3 17 6-6 4 4 8-9" /><path d="M15 6h6v6" /></>,
        user: <><circle cx="12" cy="8" r="4" /><path d="M4 21a8 8 0 0 1 16 0" /></>,
        database: <><ellipse cx="12" cy="5" rx="8" ry="3" /><path d="M4 5v14c0 1.66 3.58 3 8 3s8-1.34 8-3V5" /><path d="M4 12c0 1.66 3.58 3 8 3s8-1.34 8-3" /></>,
        menu: <><path d="M4 6h16M4 12h16M4 18h16" /></>,
        close: <><path d="m6 6 12 12M18 6 6 18" /></>,
    };
    return <svg aria-hidden="true" viewBox="0 0 24 24" className="icon" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">{paths[name] || paths.wallet}</svg>;
}
