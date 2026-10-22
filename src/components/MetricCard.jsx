import Icon from './Icon.jsx';

export default function MetricCard({ title, value, subtitle, icon, tone }) {
    return <article className="metric-card"><div className={`metric-icon ${tone}`}><Icon name={icon} /></div><div className="metric-title">{title}</div><div className="metric-value">{value}</div><div className="metric-subtitle">{subtitle}</div></article>;
}
