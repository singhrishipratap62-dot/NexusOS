export default function AgentsLoading() {
    return (
        <div style={{ padding: '24px 32px' }}>
            <div style={{ height: 32, width: 120, background: 'var(--bg-elevated)', borderRadius: 8, marginBottom: 8 }} />
            <div style={{ height: 16, width: 240, background: 'var(--bg-elevated)', borderRadius: 4, marginBottom: 24 }} />
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: 16, marginBottom: 24 }}>
                {[1, 2, 3, 4].map(i => (
                    <div key={i} className="stat-card" style={{ height: 80 }}>
                        <div style={{ height: 12, width: 60, background: 'var(--bg)', borderRadius: 4, marginBottom: 8 }} />
                        <div style={{ height: 24, width: 40, background: 'var(--bg)', borderRadius: 4 }} />
                    </div>
                ))}
            </div>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
                {[1, 2, 3].map(i => (
                    <div key={i} style={{ height: 56, background: 'var(--bg-elevated)', borderRadius: 8 }} />
                ))}
            </div>
        </div>
    );
}
