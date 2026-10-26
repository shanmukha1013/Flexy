const { test, describe } = require('node:test');
const assert = require('node:assert/strict');
const {
    createEmailService,
    EmailNotConfiguredError,
    EmailDeliveryError,
    maskEmail
} = require('../../lib/email');

// Stand-in for the Resend SDK class: records calls and returns a scripted result.
function fakeResend(behaviour) {
    const calls = [];
    class FakeResend {
        constructor(apiKey) {
            this.apiKey = apiKey;
            this.emails = {
                send: async (payload) => {
                    calls.push({ apiKey, payload });
                    return behaviour(payload);
                }
            };
        }
    }
    return { FakeResend, calls };
}

const resendConfig = (overrides = {}) => ({ transport: 'resend', resendApiKey: 're_key', from: 'Flexy <a@b.test>', ...overrides });

describe('email service', () => {
    test('constructing without an API key does not throw (the original startup crash)', () => {
        const { FakeResend, calls } = fakeResend(() => ({ data: { id: 'x' } }));
        const service = createEmailService(resendConfig({ resendApiKey: '' }), { ResendClient: FakeResend });
        assert.equal(service.isConfigured(), false);
        assert.match(service.describe(), /not configured/);
        assert.equal(calls.length, 0);
    });

    test('sending without an API key rejects with EmailNotConfiguredError', async () => {
        const service = createEmailService(resendConfig({ resendApiKey: '' }));
        await assert.rejects(service.sendOtp('u@x.test', '123456', 5), EmailNotConfiguredError);
    });

    test('successful send returns the provider message id', async () => {
        const { FakeResend, calls } = fakeResend(() => ({ data: { id: 'msg_123' }, error: null }));
        const service = createEmailService(resendConfig(), { ResendClient: FakeResend });
        const result = await service.sendOtp('u@x.test', '654321', 5);
        assert.deepEqual(result, { id: 'msg_123', provider: 'resend' });
        assert.equal(calls[0].payload.to, 'u@x.test');
        assert.equal(calls[0].payload.from, 'Flexy <a@b.test>');
        assert.match(calls[0].payload.html, /654321/);
        assert.match(calls[0].payload.text, /654321/);
    });

    test('a provider error response is surfaced as EmailDeliveryError (not success)', async () => {
        const { FakeResend } = fakeResend(() => ({
            data: null,
            error: { name: 'validation_error', statusCode: 403, message: 'You can only send testing emails to your own email address' }
        }));
        const service = createEmailService(resendConfig(), { ResendClient: FakeResend });
        await assert.rejects(service.sendOtp('u@x.test', '111111', 5), (err) => {
            assert.ok(err instanceof EmailDeliveryError);
            assert.equal(err.providerError.statusCode, 403);
            return true;
        });
    });

    test('a thrown network error is wrapped in EmailDeliveryError', async () => {
        const { FakeResend } = fakeResend(() => { throw new Error('ECONNRESET'); });
        const service = createEmailService(resendConfig(), { ResendClient: FakeResend });
        await assert.rejects(service.sendOtp('u@x.test', '111111', 5), (err) => {
            assert.ok(err instanceof EmailDeliveryError);
            assert.equal(err.cause.message, 'ECONNRESET');
            return true;
        });
    });

    test('a response without a message id is treated as a failure', async () => {
        const { FakeResend } = fakeResend(() => ({ data: {}, error: null }));
        const service = createEmailService(resendConfig(), { ResendClient: FakeResend });
        await assert.rejects(service.sendOtp('u@x.test', '111111', 5), EmailDeliveryError);
    });

    test('a hung provider times out', async () => {
        const { FakeResend } = fakeResend(() => new Promise(() => {}));
        const service = createEmailService(resendConfig(), { ResendClient: FakeResend, timeoutMs: 50 });
        await assert.rejects(service.sendOtp('u@x.test', '111111', 5), EmailDeliveryError);
    });

    test('the console transport logs the code and needs no API key', async () => {
        const lines = [];
        const service = createEmailService({ transport: 'console', resendApiKey: '', from: 'x' }, { logger: { log: (l) => lines.push(l) } });
        assert.equal(service.isConfigured(), true);
        const result = await service.sendOtp('dev@x.test', '222222', 5);
        assert.equal(result.provider, 'console');
        assert.match(lines[0], /222222/);
    });

    test('maskEmail hides most of the local part', () => {
        assert.equal(maskEmail('shanmukha@example.com'), 'sh***@example.com');
    });
});
