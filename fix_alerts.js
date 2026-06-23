const fs = require('fs');
const path = require('path');

const filesToFix = ['js/api.js', 'js/search.js', 'js/notifications.js'];

filesToFix.forEach(file => {
    const filePath = path.join(__dirname, file);
    if (fs.existsSync(filePath)) {
        let content = fs.readFileSync(filePath, 'utf8');

        // Regex to match alert(...)
        // We'll use a replacer function to determine the type
        content = content.replace(/alert\(([^)]+)\)/g, (match, p1) => {
            const inner = p1.trim();
            if (inner.includes('err.message') || inner.toLowerCase().includes('error')) {
                return `notify(${inner}, 'error')`;
            } else if (inner.toLowerCase().includes('success')) {
                return `notify(${inner}, 'success')`;
            } else {
                // If it's a string literal that says "Please login" we could use warning, but info is safe.
                return `notify(${inner}, 'info')`;
            }
        });

        fs.writeFileSync(filePath, content, 'utf8');
        console.log(`Updated ${file}`);
    } else {
        console.log(`File not found: ${file}`);
    }
});
