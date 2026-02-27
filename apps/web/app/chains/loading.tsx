export default function ChainsLoading() {
    return (
        <div style={{ padding: '24px 32px' }}>
            <div style={{ height: 32, width: 120, background: 'var(--bg-elevated)', borderRadius: 8, marginBottom: 8 }} />
            <div style={{ height: 16, width: 260, background: 'var(--bg-elevated)', borderRadius: 4, marginBottom: 24 }} />
            <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
                {[1, 2, 3].map(i => (
                    <div key={i} style={{ height: 88, background: 'var(--bg-elevated)', borderRadius: 12 }} />
                ))}
            </div>
        </div>
    );
}
