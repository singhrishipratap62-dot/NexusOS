import type { Metadata } from 'next';

export const metadata: Metadata = {
    title: 'Not Found | NexusOS'
};

export default function NotFound() {
    return (
        <html lang="en">
            <body style={{ background: '#0a0a0a', color: '#fff', fontFamily: 'system-ui', display: 'flex', alignItems: 'center', justifyContent: 'center', height: '100vh', margin: 0 }}>
                <div style={{ textAlign: 'center' }}>
                    <h1 style={{ fontSize: '4rem', margin: 0, color: '#6366f1' }}>404</h1>
                    <p style={{ color: '#888' }}>Page not found</p>
                    <a href="/" style={{ color: '#6366f1' }}>Return Home</a>
                </div>
            </body>
        </html>
    );
}
