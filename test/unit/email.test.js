const { test, describe } = require('node:test');
const assert = require('node:assert/strict');
const {
    createEmailService,
    otpEmailContent,
    EmailNotConfiguredError,
    EmailDeliveryError,
    maskEmail,
    escapeHtml
} = require('../../lib/email');

// Stand-in for the Resend SDK class: records calls and returns a scripted result.
function fakeResend(behaviour) {
    const calls = [];
    class FakeResend {
        constructor(apiKey) {
            this.apiKey = apiKey;
            this.emails = {
                send: async (payload, options) => {
                    calls.push({ apiKey, payload, options });
                    return behaviour(payload, options);
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

    test('the send is given an AbortSignal so a hung request is actually cancelled', async () => {
        let seenSignal;
        const { FakeResend } = fakeResend((payload, options) => {
            seenSignal = options && options.signal;
            return new Promise(() => {});
        });
        const service = createEmailService(resendConfig(), { ResendClient: FakeResend, timeoutMs: 50 });
        await assert.rejects(service.sendOtp('u@x.test', '111111', 5), (err) => {
            assert.equal(err.timedOut, true);
            return true;
        });
        assert.ok(seenSignal instanceof AbortSignal);
        assert.equal(seenSignal.aborted, true);
    });

    test('a 429 from the provider is flagged as rate limited', async () => {
        const { FakeResend } = fakeResend(() => ({ data: null, error: { name: 'rate_limit_exceeded', statusCode: 429, message: 'slow down' } }));
        const service = createEmailService(resendConfig(), { ResendClient: FakeResend });
        await assert.rejects(service.sendOtp('u@x.test', '111111', 5), (err) => err.rateLimited === true);
    });

    test('an SDK-reported network failure (statusCode null) is a delivery error', async () => {
        const { FakeResend } = fakeResend(() => ({ data: null, error: { name: 'application_error', statusCode: null, message: 'Unable to fetch data.' } }));
        const service = createEmailService(resendConfig(), { ResendClient: FakeResend });
        await assert.rejects(service.sendOtp('u@x.test', '111111', 5), (err) => err instanceof EmailDeliveryError && !err.rateLimited);
    });
});

describe('OTP email content', () => {
    const content = otpEmailContent('042917', 5);

    test('has a subject, an HTML body and a plain-text alternative containing the code', () => {
        assert.equal(content.subject, 'Your Flexy verification code');
        assert.ok(content.html.includes('042917'));
        assert.ok(content.text.includes('042917'));
        assert.doesNotMatch(content.subject, /\d{6}/);
    });

    test('states the five-minute expiry and warns not to share the code', () => {
        assert.match(content.html, /expires in <strong>5 minutes<\/strong>/);
        assert.match(content.text, /expires in 5 minutes/);
        assert.match(content.html, /Do not share this code/);
        assert.match(content.text, /Do not share this code/);
    });

    test('is branded and laid out for mobile clients', () => {
        assert.match(content.html, /FLEXY/);
        assert.match(content.html, /<meta name="viewport" content="width=device-width, initial-scale=1">/);
        assert.match(content.html, /max-width:480px/);
    });

    test('escapes dynamic values', () => {
        const hostile = otpEmailContent('<img src=x onerror=alert(1)>', '5"><script>');
        assert.doesNotMatch(hostile.html, /<img src=x|<script>/);
        assert.equal(escapeHtml(`<a href="x">'&`), '&lt;a href=&quot;x&quot;&gt;&#39;&amp;');
    });

    test('uses the singular for a one-minute expiry', () => {
        assert.match(otpEmailContent('123456', 1).text, /expires in 1 minute and/);
    });
});
