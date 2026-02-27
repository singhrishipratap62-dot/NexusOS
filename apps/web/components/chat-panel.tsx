'use client';

import { useState, useRef, useEffect, useCallback, FormEvent } from 'react';

/* ──────────────────── Types ──────────────────── */
interface ChatMsg {
    role: 'user' | 'assistant';
    content: string;
    action?: string | null;
    timestamp: Date;
}

/* ──────────────────── Constants ──────────────────── */
const QUICK_ACTIONS = [
    { label: 'View Workflows', message: 'What are my top automation opportunities?' },
    { label: 'Get Started', message: 'How do I get started with NexusOS?' },
    { label: 'Book a Demo', message: 'I want to book a demo to learn more' }
];

const WELCOME_MESSAGE: ChatMsg = {
    role: 'assistant',
    content: "Hi! I'm your NexusOS Meta-Agent. I can analyze workflows, generate automation agents, and track outcomes. What would you like to do?",
    action: null,
    timestamp: new Date()
};

const REQUEST_TIMEOUT_MS = 15000;

/* ──────────────────── Bot Avatar ──────────────────── */
function BotAvatar() {
    return (
        <div style={{
            width: 28,
            height: 28,
            borderRadius: '50%',
            background: 'linear-gradient(135deg, #7C3AED, #9333EA)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            flexShrink: 0
        }}>
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="white" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <rect x="3" y="11" width="18" height="10" rx="2" />
                <circle cx="12" cy="5" r="2" />
                <path d="M12 7v4" />
                <line x1="8" y1="16" x2="8" y2="16" />
                <line x1="16" y1="16" x2="16" y2="16" />
            </svg>
        </div>
    );
}

/* ──────────────────── Typing Dots ──────────────────── */
function TypingDots() {
    return (
        <div style={{ display: 'flex', alignItems: 'flex-start', gap: 8 }}>
            <BotAvatar />
            <div style={{
                background: '#F0F0F0',
                borderRadius: '18px 18px 18px 4px',
                padding: '12px 16px',
                display: 'flex',
                gap: 4,
                alignItems: 'center'
            }}>
                <span className="chat-dot chat-dot-1" />
                <span className="chat-dot chat-dot-2" />
                <span className="chat-dot chat-dot-3" />
            </div>
        </div>
    );
}

/* ──────────────────── Main Component ──────────────────── */
export function ChatPanel() {
    const [isOpen, setIsOpen] = useState(false);
    const [messages, setMessages] = useState<ChatMsg[]>([WELCOME_MESSAGE]);
    const [input, setInput] = useState('');
    const [isLoading, setIsLoading] = useState(false);
    const [conversationId, setConversationId] = useState<string | null>(null);
    const messagesEndRef = useRef<HTMLDivElement>(null);
    const inputRef = useRef<HTMLInputElement>(null);

    useEffect(() => {
        messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
    }, [messages, isLoading]);

    useEffect(() => {
        if (isOpen) inputRef.current?.focus();
    }, [isOpen]);

    const sendMessage = useCallback(async (text: string) => {
        if (!text.trim() || isLoading) return;

        const userMsg: ChatMsg = { role: 'user', content: text, timestamp: new Date() };
        setMessages(prev => [...prev, userMsg]);
        setInput('');
        setIsLoading(true);

        const controller = new AbortController();
        const timeout = setTimeout(() => controller.abort(), REQUEST_TIMEOUT_MS);

        try {
            const res = await fetch(`/api/proxy?path=${encodeURIComponent('/ai/chat')}`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ message: text, conversationId }),
                signal: controller.signal
            });

            clearTimeout(timeout);

            if (!res.ok) {
                const errData = await res.json().catch(() => null);
                throw new Error(errData?.message || `Server error (${res.status})`);
            }

            const data = await res.json();
            if (data.conversationId) setConversationId(data.conversationId);

            setMessages(prev => [...prev, {
                role: 'assistant',
                content: data.reply || "Sorry, I couldn't process that. Please try again.",
                action: data.action ?? null,
                timestamp: new Date()
            }]);
        } catch (err: any) {
            clearTimeout(timeout);
            const isTimeout = err?.name === 'AbortError';
            setMessages(prev => [...prev, {
                role: 'assistant',
                content: isTimeout
                    ? 'Sorry, that took too long. Please try again.'
                    : `Something went wrong: ${err.message || 'Connection error'}. Please try again.`,
                action: null,
                timestamp: new Date()
            }]);
        } finally {
            setIsLoading(false);
        }
    }, [isLoading, conversationId]);

    const handleSubmit = (e: FormEvent) => {
        e.preventDefault();
        sendMessage(input);
    };

    const formatTime = (d: Date) =>
        d.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });

    /* ──── Closed State: FAB ──── */
    if (!isOpen) {
        return (
            <button
                onClick={() => setIsOpen(true)}
                className="chat-fab"
                title="Ask NexusOS AI"
            >
                <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                    <path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z" />
                </svg>
            </button>
        );
    }

    /* ──── Open State: Widget ──── */
    return (
        <div className="chat-widget chat-widget-enter">
            {/* Header */}
            <div className="chat-header">
                <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                    <div style={{
                        width: 34,
                        height: 34,
                        borderRadius: '50%',
                        background: 'rgba(255,255,255,0.2)',
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'center'
                    }}>
                        <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="white" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                            <rect x="3" y="11" width="18" height="10" rx="2" />
                            <circle cx="12" cy="5" r="2" />
                            <path d="M12 7v4" />
                            <line x1="8" y1="16" x2="8" y2="16" />
                            <line x1="16" y1="16" x2="16" y2="16" />
                        </svg>
                    </div>
                    <div>
                        <div style={{ fontWeight: 600, fontSize: 14, color: '#fff' }}>NexusOS AI</div>
                        <div style={{ fontSize: 11, color: 'rgba(255,255,255,0.75)' }}>Meta-Agent Assistant</div>
                    </div>
                </div>
                <button
                    onClick={() => setIsOpen(false)}
                    style={{
                        background: 'rgba(255,255,255,0.15)',
                        border: 'none',
                        borderRadius: '50%',
                        width: 28,
                        height: 28,
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'center',
                        cursor: 'pointer',
                        color: '#fff',
                        transition: 'background 0.15s'
                    }}
                    onMouseOver={e => (e.currentTarget.style.background = 'rgba(255,255,255,0.25)')}
                    onMouseOut={e => (e.currentTarget.style.background = 'rgba(255,255,255,0.15)')}
                >
                    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                        <line x1="18" y1="6" x2="6" y2="18" />
                        <line x1="6" y1="6" x2="18" y2="18" />
                    </svg>
                </button>
            </div>

            {/* Messages */}
            <div className="chat-messages">
                {messages.map((msg, i) => (
                    <div key={i} className={`chat-row ${msg.role === 'user' ? 'chat-row-user' : 'chat-row-bot'}`}>
                        {msg.role === 'assistant' && <BotAvatar />}
                        <div className="chat-bubble-wrap">
                            <div
                                className={msg.role === 'user' ? 'chat-bubble-user' : 'chat-bubble-bot'}
                                title={formatTime(msg.timestamp)}
                            >
                                {msg.content}
                            </div>
                            {msg.action && (
                                <div className="chat-action-badge">
                                    <svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                                        <polyline points="9 18 15 12 9 6" />
                                    </svg>
                                    Action: {msg.action}
                                </div>
                            )}
                        </div>
                    </div>
                ))}

                {isLoading && <TypingDots />}

                {/* Quick actions - only when just welcome message */}
                {messages.length === 1 && !isLoading && (
                    <div className="chat-quick-actions">
                        {QUICK_ACTIONS.map((qa, i) => (
                            <button
                                key={i}
                                onClick={() => sendMessage(qa.message)}
                                className="chat-quick-btn"
                            >
                                {qa.label}
                            </button>
                        ))}
                    </div>
                )}

                <div ref={messagesEndRef} />
            </div>

            {/* Input */}
            <form onSubmit={handleSubmit} className="chat-input-area">
                <input
                    ref={inputRef}
                    type="text"
                    value={input}
                    onChange={e => setInput(e.target.value)}
                    placeholder="Type a message..."
                    disabled={isLoading}
                    className="chat-input"
                />
                <button
                    type="submit"
                    disabled={!input.trim() || isLoading}
                    className="chat-send-btn"
                >
                    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                        <line x1="22" y1="2" x2="11" y2="13" />
                        <polygon points="22 2 15 22 11 13 2 9 22 2" />
                    </svg>
                </button>
            </form>
        </div>
    );
}
