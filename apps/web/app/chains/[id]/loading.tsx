export default function ChainDetailLoading() {
    return (
        <div style={{ padding: '24px 32px' }}>
            <div style={{ height: 32, width: 200, background: 'var(--bg-elevated)', borderRadius: 8, marginBottom: 8 }} />
            <div style={{ height: 16, width: 300, background: 'var(--bg-elevated)', borderRadius: 4, marginBottom: 24 }} />
            <div style={{ display: 'flex', gap: 16, marginBottom: 24 }}>
                {[1, 2, 3].map(i => (
                    <div key={i} style={{ flex: 1, height: 120, background: 'var(--bg-elevated)', borderRadius: 12 }} />
                ))}
            </div>
            <div style={{ height: 200, background: 'var(--bg-elevated)', borderRadius: 12 }} />
        </div>
    );
}
