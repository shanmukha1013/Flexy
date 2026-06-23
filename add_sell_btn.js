const fs = require('fs');
const path = require('path');

const dir = __dirname;
const files = fs.readdirSync(dir).filter(f => f.endsWith('.html'));

const sellBtn = `\n                <button class="btn btn-primary" onclick="window.location.href='sell.html'" style="margin-left: 1rem; padding: 0.4rem 1.2rem; border-radius: var(--radius-full);">Sell Item</button>`;

files.forEach(file => {
    const filePath = path.join(dir, file);
    let content = fs.readFileSync(filePath, 'utf8');
    
    // Check if header-actions exists and if Sell Item is not already there
    if (content.includes('class="header-actions"') && !content.includes('>Sell Item</button>')) {
        // Find the closing div of header-actions
        // The last button is usually profile.html or similar
        content = content.replace(/(<button class="header-btn"[^>]*>Profile<\/button>)/, `$1${sellBtn}`);
        fs.writeFileSync(filePath, content, 'utf8');
        console.log(`Updated header in ${file}`);
    }
});
