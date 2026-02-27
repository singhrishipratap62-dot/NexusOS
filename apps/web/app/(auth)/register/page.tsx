'use client';
export const dynamic = 'force-dynamic';

import { useState } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { UserPlus, Loader2 } from 'lucide-react';

export default function RegisterPage() {
    const router = useRouter();

    const [name, setName] = useState('');
    const [email, setEmail] = useState('');
    const [password, setPassword] = useState('');
    const [error, setError] = useState('');
    const [loading, setLoading] = useState(false);

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        setError('');
        setLoading(true);

        try {
            const response = await fetch('/api/auth/register', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ email, password, name: name || undefined })
            });

            const data = await response.json();

            if (!response.ok) {
                setError(data.message ?? 'Registration failed');
                return;
            }

            router.push('/war-room');
            router.refresh();
        } catch {
            setError('Something went wrong. Please try again.');
        } finally {
            setLoading(false);
        }
    };

    return (
        <div className="auth-card">
            <div className="auth-card-header">
                <h1 className="text-xl font-semibold text-foreground">Create your account</h1>
                <p className="text-sm text-muted-foreground mt-1">
                    Start auditing your team&apos;s workflows with NexusOS
                </p>
            </div>

            <form onSubmit={handleSubmit} className="auth-form">
                {error && (
                    <div className="auth-error">
                        {error}
                    </div>
                )}

                <div className="form-group">
                    <label htmlFor="name" className="form-label">Name</label>
                    <input
                        id="name"
                        type="text"
                        className="input"
                        placeholder="Jane Smith"
                        value={name}
                        onChange={(e) => setName(e.target.value)}
                        autoComplete="name"
                        autoFocus
                    />
                </div>

                <div className="form-group">
                    <label htmlFor="email" className="form-label">Email</label>
                    <input
                        id="email"
                        type="email"
                        className="input"
                        placeholder="you@company.com"
                        value={email}
                        onChange={(e) => setEmail(e.target.value)}
                        required
                        autoComplete="email"
                    />
                </div>

                <div className="form-group">
                    <label htmlFor="password" className="form-label">Password</label>
                    <input
                        id="password"
                        type="password"
                        className="input"
                        placeholder="••••••••"
                        value={password}
                        onChange={(e) => setPassword(e.target.value)}
                        required
                        autoComplete="new-password"
                        minLength={8}
                    />
                    <p className="text-xs text-muted-foreground mt-1">Must be at least 8 characters</p>
                </div>

                <button
                    type="submit"
                    className="btn-primary w-full flex items-center justify-center gap-2"
                    disabled={loading}
                >
                    {loading ? (
                        <Loader2 className="w-4 h-4 animate-spin" />
                    ) : (
                        <UserPlus className="w-4 h-4" />
                    )}
                    {loading ? 'Creating account...' : 'Create Account'}
                </button>
            </form>

            <p className="auth-footer">
                Already have an account?{' '}
                <Link href="/login" className="auth-link">
                    Sign in
                </Link>
            </p>
        </div>
    );
}
