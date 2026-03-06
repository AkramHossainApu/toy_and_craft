import { state } from '../core/state.js';
import { showErrorPage } from '../core/utils.js';
import { openAuthModal } from './auth.js';
import { toggleAdminMode, promptPassword } from './admin.js';

// --- URL Routing Utility ---

export function updateUrlState(categorySlug, pageNum = 1, productSlug = null) {
    if (!categorySlug) return;

    // Ignore updates for base auth actions where categorySlug is abused
    if (['login', 'register', 'admin', 'authenticate-admin', 'Details', 'Orders', 'Checkout...'].includes(categorySlug)) {
        let newPath = `/${categorySlug}`;
        if (state.currentUser && (categorySlug === 'Details' || categorySlug === 'Orders')) {
            newPath = `/${state.currentUser.id}/${categorySlug}`;
        }
        try {
            window.history.pushState({ path: newPath }, '', newPath);
        } catch (e) {
            console.warn("pushState failed", e);
        }
        return;
    }

    let newPath = `/${categorySlug}`;
    if (state.currentUser) {
        newPath = `/${state.currentUser.id}/${categorySlug}`;
    }

    if (pageNum >= 1) {
        newPath += `/page-${pageNum}`;
    }

    if (productSlug) {
        newPath += `/${productSlug}`;
    }

    // Get the base segment dynamically, so deployment on GitHub Pages still functions properly
    let baseUri = '/';
    if (window.location.pathname.startsWith('/toy_and_craft')) {
        baseUri = '/toy_and_craft/';
    }

    try {
        window.history.pushState({ path: baseUri + newPath.replace(/^\//, '') }, '', baseUri + newPath.replace(/^\//, ''));
    } catch (e) {
        console.warn("pushState failed, likely not running on a server.", e);
    }
}
window.updateUrlState = updateUrlState;

export function processRoute() {

    const bounceToRoot = () => {
        if (state.categories.length > 0) {
            state.currentCategorySlug = state.categories[0].slug;
            state.currentPage = 1;
            updateUrlState(state.currentCategorySlug, state.currentPage);
        }
    };

    // GitHub pages hosts repository at /toy_and_craft/ instead of literal root
    const path = window.location.pathname;
    let safePath = path;
    if (safePath.startsWith('/toy_and_craft')) {
        safePath = safePath.replace('/toy_and_craft', '');
    }
    const parts = safePath.split('/').filter(p => p.length > 0);

    if (parts.length === 0) {
        // Base URL loaded
        bounceToRoot();
    } else {
        // Deep link detection
        let maybeUser = parts[0];
        let rawAction = parts.length > 1 ? parts[1] : parts[0];
        let maybeAction = rawAction.toLowerCase();

        if (maybeAction === 'login' || maybeAction === 'register') {
            if (state.categories.length > 0) state.currentCategorySlug = state.categories[0].slug;
            if (state.currentUser) {
                // Already authenticated, reject Auth prompt
                bounceToRoot();
            } else {
                // Open Auth Mode
                updateUrlState(maybeAction);
                if (window.openAuthModal) window.openAuthModal(maybeAction);
            }
        } else if (maybeAction === 'admin' || maybeAction === 'authenticate-admin') {
            if (state.categories.length > 0) state.currentCategorySlug = state.categories[0].slug;
            if (state.isAdmin) {
                updateUrlState('admin');
            } else {
                updateUrlState('authenticate-admin');
                if (window.promptPassword) {
                    window.promptPassword("Enter Admin Password", (pass) => {
                        if (pass === atob("MDEyNw==")) {
                            if (window.toggleAdminMode) window.toggleAdminMode(true);
                        } else {
                            alert("Incorrect password.");
                        }
                    });
                }
            }
        } else if (maybeAction === 'search' || (parts.length === 2 && parts[0] === 'search')) {
            // --- Search URL routing ---
            let searchKeyword = null;

            if (parts[0] === 'search' && parts.length >= 2) {
                // /search/keyword — guest URL
                searchKeyword = decodeURIComponent(parts.slice(1).join('/'));
                if (state.currentUser) {
                    // Logged-in user accessing guest search URL — redirect to /userid/search/keyword
                    let baseUri = '/';
                    if (window.location.pathname.startsWith('/toy_and_craft')) baseUri = '/toy_and_craft/';
                    const newPath = `${state.currentUser.id}/search/${encodeURIComponent(searchKeyword)}`;
                    try {
                        window.history.replaceState({ path: baseUri + newPath }, '', baseUri + newPath);
                    } catch (e) { }
                }
            } else if (maybeAction === 'search' && parts.length >= 3) {
                // /userid/search/keyword — user URL
                searchKeyword = decodeURIComponent(parts.slice(2).join('/'));
                if (!state.currentUser) {
                    // Non-logged-in user accessing user search URL — redirect to /search/keyword
                    let baseUri = '/';
                    if (window.location.pathname.startsWith('/toy_and_craft')) baseUri = '/toy_and_craft/';
                    const newPath = `search/${encodeURIComponent(searchKeyword)}`;
                    try {
                        window.history.replaceState({ path: baseUri + newPath }, '', baseUri + newPath);
                    } catch (e) { }
                }
            }

            if (searchKeyword) {
                // Set default category so tabs render, then trigger search
                if (state.categories.length > 0) {
                    state.currentCategorySlug = state.categories[0].slug;
                }
                window.pendingSearchKeyword = searchKeyword;
            } else {
                bounceToRoot();
            }
        } else if (rawAction === 'Details' || rawAction === 'Orders') {
            // Keep case-sensitive checking for Profile URLs due to IDs potentially passing here
            if (!state.currentUser || state.currentUser.id !== maybeUser) {
                // Unauthorized or not logged in, boot to base
                bounceToRoot();
            } else {
                // Authorized
                if (state.categories.length > 0) state.currentCategorySlug = state.categories[0].slug;
                if (window.openAuthModal) window.openAuthModal('profile');
                if (maybeAction === 'Details') {
                    const tabDetails = document.getElementById('tab-profile-details');
                    if (tabDetails) tabDetails.click();
                } else if (maybeAction === 'Orders') {
                    const tabOrders = document.getElementById('tab-profile-orders');
                    if (tabOrders) tabOrders.click();
                }
            }
        } else {
            // Assume URL logic: user isn't logged in but tries /userid/cat/[page-N|prod] => rewrite
            let urlUserId = null;
            let targetCategory = null;
            let targetPage = 1;
            let targetProduct = null;

            if (state.categories.find(c => c.slug === parts[0])) {
                targetCategory = parts[0];
                if (parts.length > 1) {
                    if (parts[1].startsWith('page-')) {
                        targetPage = parseInt(parts[1].split('-')[1]) || 1;
                        if (parts.length > 2) targetProduct = parts[2];
                    } else {
                        targetProduct = parts[1];
                    }
                }
            } else {
                urlUserId = parts[0];
                if (parts.length > 1) {
                    targetCategory = parts[1];
                }
                if (parts.length > 2) {
                    if (parts[2].startsWith('page-')) {
                        targetPage = parseInt(parts[2].split('-')[1]) || 1;
                        if (parts.length > 3) targetProduct = parts[3];
                    } else {
                        targetProduct = parts[2];
                    }
                }
            }

            if (!state.currentUser && urlUserId) {
                let newPath = `/${targetCategory || (state.categories.length > 0 ? state.categories[0].slug : '')}`;
                if (targetPage >= 1) newPath += `/page-${targetPage}`;
                if (targetProduct) newPath += `/${targetProduct}`;

                let baseUri = '/';
                if (window.location.pathname.startsWith('/toy_and_craft')) {
                    baseUri = '/toy_and_craft/';
                }

                try {
                    window.history.replaceState({ path: baseUri + newPath.replace(/^\//, '') }, '', baseUri + newPath.replace(/^\//, ''));
                } catch (e) { }
            }

            const catExists = targetCategory && state.categories.find(c => c.slug === targetCategory);

            // 404 Guard: Invalid Category in URL
            if (targetCategory && !catExists) {
                showErrorPage(`Category "${targetCategory}" does not exist.`);
                return;
            }

            state.currentCategorySlug = catExists ? targetCategory : (state.categories.length > 0 ? state.categories[0].slug : null);
            state.currentPage = targetPage;

            if (targetProduct) {
                window.pendingProductSlug = targetProduct;
            } else {
                window.pendingProductSlug = null;
                updateUrlState(state.currentCategorySlug, state.currentPage);
            }
        }
    }

    if (window.renderCategoryTabs) window.renderCategoryTabs();

    // Now trigger the actual page render based on the parsed URL
    const productViewSection = document.getElementById('product-view');
    const shopSection = document.getElementById('shop');

    if (window.pendingProductSlug) {
        const tempSlug = window.pendingProductSlug;
        window.pendingProductSlug = null;

        if (productViewSection) productViewSection.style.display = 'block';
        if (shopSection) shopSection.style.display = 'none';

        if (window.renderProductPage) window.renderProductPage(tempSlug);
    } else if (window.pendingSearchKeyword) {
        const keyword = window.pendingSearchKeyword;
        window.pendingSearchKeyword = null;

        if (productViewSection) productViewSection.style.display = 'none';
        if (shopSection) shopSection.style.display = 'block';

        // Render default products first so grid exists, then trigger search
        if (window.renderProducts && state.currentCategorySlug) {
            window.renderProducts(state.currentCategorySlug, 1);
        }
        // Trigger search after a short delay to let DOM settle
        setTimeout(() => {
            if (window.triggerSearchFromUrl) window.triggerSearchFromUrl(keyword);
        }, 100);
    } else if (state.currentCategorySlug) {

        if (!window.location.pathname.includes('/Details') && !window.location.pathname.includes('/Orders')) {
            if (productViewSection) productViewSection.style.display = 'none';
            if (shopSection) shopSection.style.display = 'block';
        }

        if (window.renderProducts) window.renderProducts(state.currentCategorySlug, state.currentPage || 1);
    }
}
window.processRoute = processRoute;

export function initRouting() {
    if (state.routingInitialized) return;
    state.routingInitialized = true;
    processRoute();
}
window.initRouting = initRouting;

window.addEventListener('popstate', (e) => {
    console.log("Navigated via history", location.pathname);

    // Hide specialized views and error screens when navigating back to base routes
    const productViewSection = document.getElementById('product-view');
    const shopSection = document.getElementById('shop');
    const errorViewSection = document.getElementById('error-view');

    if (errorViewSection) errorViewSection.style.display = 'none';

    // Re-evaluate the current URL and trigger rendering
    processRoute();

    // Ensure shop layout is visible if we aren't rendering a product
    if (!window.pendingProductSlug && !window.location.pathname.includes('/Details') && !window.location.pathname.includes('/Orders')) {
        if (productViewSection) productViewSection.style.display = 'none';
        if (shopSection) shopSection.style.display = 'block';
    }
});
