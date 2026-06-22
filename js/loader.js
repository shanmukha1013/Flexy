// loader.js - Premium Single-Session Loader and Global UX Polish

document.addEventListener('DOMContentLoaded', () => {
    // 1. Single-session loader overlay
    const loaderShown = sessionStorage.getItem('flexy_loader_shown');
    
    if (!loaderShown) {
        const loader = document.createElement('div');
        loader.id = 'premium-loader';
        loader.className = 'premium-loader-overlay';
        
        loader.innerHTML = `
            <div class="loader-content">
                <div class="loader-logo-wrapper">
                    <svg viewBox="0 0 32 32" class="loader-logo-svg" fill="none">
                        <rect x="6" y="5" width="18" height="4" rx="1" fill="currentColor" />
                        <rect x="11" y="9" width="3" height="17" rx="1" fill="currentColor" />
                        <rect x="14" y="13" width="7" height="3" rx="0.75" fill="currentColor" />
                        <rect x="5" y="25" width="10" height="2" rx="0.5" fill="currentColor" />
                    </svg>
                </div>
                <h1 class="loader-text">FLEXY</h1>
                <div class="loader-progress-container">
                    <div class="loader-progress-bar"></div>
                </div>
            </div>
        `;
        
        document.body.appendChild(loader);
        
        // Block scrolling while loading
        document.body.style.overflow = 'hidden';
        
        setTimeout(() => {
            loader.style.opacity = '0';
            document.body.style.overflow = '';
            
            setTimeout(() => {
                loader.remove();
                sessionStorage.setItem('flexy_loader_shown', 'true');
                window.dispatchEvent(new CustomEvent('flexy_loader_finished'));
            }, 500);
        }, 2200);
    }

    // 2. Global Scroll-Driven Blur Navbar
    const handleScroll = () => {
        const header = document.querySelector('.app-header');
        if (header) {
            if (window.scrollY > 15) {
                header.classList.add('scrolled');
            } else {
                header.classList.remove('scrolled');
            }
        }
    };
    window.addEventListener('scroll', handleScroll);
    handleScroll(); // Trigger once on load
});
