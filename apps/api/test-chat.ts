import 'reflect-metadata';
import * as dotenv from 'dotenv';
import { resolve } from 'path';
dotenv.config({ path: resolve(__dirname, '.env') });
import { JwtTokenService } from './src/auth/jwt-token.service';

async function run() {
    // Pass a fake/null PrismaService since generateTokenPair doesn't use it
    const jwt = new JwtTokenService(null as any);
    const tokens = await jwt.generateTokenPair('user_1', 'tenant_day1', 'ADMIN');

    console.log('Got token, sending request to chat...');

    try {
        const res = await fetch('http://localhost:3000/ai/chat', {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'Authorization': `Bearer ${tokens.accessToken}`
            },
            body: JSON.stringify({ message: "What are my top automation opportunities?" })
        });

        console.log('API Status:', res.status);
        const data = await res.json();
        console.log('\n--- AI RESPONSE ---');
        console.log(data);
        console.log('-------------------\n');
    } catch (err) {
        console.error('Test Failed:', err);
    }
}
run();
