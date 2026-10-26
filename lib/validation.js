// lib/validation.js
// Request input helpers shared by the route modules.
//
// The frontend renders most server data through innerHTML template strings,
// so user-supplied text is normalised here as a defence-in-depth measure:
// angle brackets are stripped from free text and image fields only accept
// URLs that cannot break out of a CSS url('...') or an HTML attribute.

const mongoose = require('mongoose');

class HttpError extends Error {
    constructor(status, message) {
        super(message);
        this.name = 'HttpError';
        this.status = status;
    }
}

const badRequest = (message) => new HttpError(400, message);

const OBJECT_ID_RE = /^[a-f0-9]{24}$/i;
const EMAIL_RE = /^[^\s@<>"'()]+@[^\s@<>"'()]+\.[^\s@<>"'()]+$/;
const USERNAME_RE = /^[a-zA-Z0-9_.]{3,30}$/;
const DATA_IMAGE_RE = /^data:image\/(png|jpe?g|gif|webp|avif|bmp|heic|heif|svg\+xml);base64,[A-Za-z0-9+/]+=*$/;
const HTTP_URL_RE = /^https?:\/\/[^\s"'()<>\\`]+$/i;
const RELATIVE_ASSET_RE = /^assets\/[A-Za-z0-9_\-./]+$/;
const MAX_IMAGE_URL_LENGTH = 12 * 1024 * 1024;

function isObjectId(value) {
    return typeof value === 'string' && OBJECT_ID_RE.test(value) && mongoose.isValidObjectId(value);
}

// For router.param(): reject malformed ids with 400 instead of a CastError 500.
function validateIdParam(req, res, next, value, name) {
    if (!isObjectId(value)) return res.status(400).json({ error: `Invalid ${name}` });
    next();
}

function requireObjectId(value, field) {
    if (!isObjectId(value)) throw badRequest(`${field} must be a valid id`);
    return value;
}

function normalizeEmail(value) {
    if (typeof value !== 'string') return null;
    const email = value.trim().toLowerCase();
    return email.length <= 254 && EMAIL_RE.test(email) ? email : null;
}

// Returns undefined when the field is absent so callers can do partial updates.
function cleanText(value, field, { max = 1000, required = false } = {}) {
    if (value === undefined || value === null) {
        if (required) throw badRequest(`${field} is required`);
        return undefined;
    }
    if (typeof value !== 'string' && typeof value !== 'number') {
        throw badRequest(`${field} must be text`);
    }
    const text = String(value).replace(/[<>]/g, '').trim();
    if (required && text.length === 0) throw badRequest(`${field} is required`);
    if (text.length > max) throw badRequest(`${field} must be at most ${max} characters`);
    return text;
}

function cleanImageUrl(value, field) {
    if (value === undefined || value === null) return undefined;
    if (typeof value !== 'string') throw badRequest(`${field} must be a URL`);
    const url = value.trim();
    if (url === '') return '';
    if (url.length > MAX_IMAGE_URL_LENGTH) throw badRequest(`${field} is too large`);
    if (DATA_IMAGE_RE.test(url) || HTTP_URL_RE.test(url) || RELATIVE_ASSET_RE.test(url)) return url;
    throw badRequest(`${field} must be an http(s) URL or a base64 image`);
}

function cleanImageList(value, field, { maxItems = 10 } = {}) {
    if (value === undefined || value === null) return undefined;
    if (!Array.isArray(value)) throw badRequest(`${field} must be a list`);
    if (value.length > maxItems) throw badRequest(`${field} can contain at most ${maxItems} entries`);
    return value.map((v, i) => cleanImageUrl(v, `${field}[${i}]`)).filter(Boolean);
}

function cleanNumber(value, field, { min = 0, max = Number.MAX_SAFE_INTEGER, required = false } = {}) {
    if (value === undefined || value === null || value === '') {
        if (required) throw badRequest(`${field} is required`);
        return undefined;
    }
    const num = typeof value === 'number' ? value : Number(value);
    if (!Number.isFinite(num) || num < min || num > max) {
        throw badRequest(`${field} must be a number between ${min} and ${max}`);
    }
    return num;
}

function escapeRegex(text) {
    return text.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

module.exports = {
    HttpError,
    badRequest,
    USERNAME_RE,
    isObjectId,
    validateIdParam,
    requireObjectId,
    normalizeEmail,
    cleanText,
    cleanImageUrl,
    cleanImageList,
    cleanNumber,
    escapeRegex
};
