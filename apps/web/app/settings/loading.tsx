export default function SettingsLoading() {
    return (
        <div style={{ padding: '24px 32px' }}>
            <div style={{ height: 32, width: 100, background: 'var(--bg-elevated)', borderRadius: 8, marginBottom: 8 }} />
            <div style={{ height: 16, width: 200, background: 'var(--bg-elevated)', borderRadius: 4, marginBottom: 32 }} />
            <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
                {[1, 2, 3, 4].map(i => (
                    <div key={i} style={{ height: 64, background: 'var(--bg-elevated)', borderRadius: 8 }} />
                ))}
            </div>
        </div>
    );
}
