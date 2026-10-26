// scripts/check-syntax.js
// Parses every project JavaScript file (backend and browser scripts) with
// `node --check`. This is a syntax gate, not a linter: it catches files that
// would fail to load, nothing more.

const { execFileSync } = require('child_process');
const fs = require('fs');
const path = require('path');

const ROOT = path.join(__dirname, '..');
const SKIP_DIRS = new Set(['node_modules', '.git', 'coverage']);
// Legacy file that no page loads (public/assets/item.html resolves to
// public/assets/js/item.js instead). Its template literals were saved with
// escaped backticks, so it does not parse. Kept until someone decides to delete it.
const SKIP_FILES = new Set([path.join('public', 'js', 'item.js')]);

function collect(dir, out = []) {
    for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
        if (entry.isDirectory()) {
            if (!SKIP_DIRS.has(entry.name)) collect(path.join(dir, entry.name), out);
        } else if (entry.name.endsWith('.js')) {
            const file = path.join(dir, entry.name);
            if (!SKIP_FILES.has(path.relative(ROOT, file))) out.push(file);
        }
    }
    return out;
}

const files = collect(ROOT);
const failures = [];
for (const file of files) {
    try {
        execFileSync(process.execPath, ['--check', file], { stdio: 'pipe' });
    } catch (err) {
        failures.push({ file: path.relative(ROOT, file), output: String(err.stderr || err.message).trim() });
    }
}

for (const { file, output } of failures) console.error(`✗ ${file}\n${output}\n`);
console.log(`Checked ${files.length} files: ${files.length - failures.length} ok, ${failures.length} failed.`);
process.exit(failures.length ? 1 : 0);
