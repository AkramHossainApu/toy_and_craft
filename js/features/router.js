import { state } from '../core/state.js';
import { showErrorPage } from '../core/utils.js';
import { openAuthModal } from './auth.js';
import { toggleAdminMode, promptPassword } from './admin.js';

// --- URL Routing Utility ---

function getBaseUri() {
    if (window.location.pathname.startsWith('/toy_and_craft')) {
        return '/toy_and_craft/';
    }
    return '/';
}

export function updateUrlState(categorySlug, pageNum = 1, productSlug = null) {
    if (!categorySlug) return;

    // Ignore updates for base auth actions where categorySlug is abused
    if (['login', 'register', 'forgot', 'authenticate-admin', 'Details', 'Orders', 'Checkout...'].includes(categorySlug)) {
        let newPath = `/${categorySlug}`;
        if (state.currentUser && (categorySlug === 'Details' || categorySlug === 'Orders')) {
            newPath = `/${state.currentUser.id}/${categorySlug}`;
        }
        try {
            window.history.pushState({ path: newPath }, '', getBaseUri() + newPath.replace(/^\//, ''));
        } catch (e) {
            console.warn("pushState failed", e);
        }
        return;
    }

    // Admin-specific pages (all-orders, users-list, sold-products)
    if (['all-orders', 'users-list', 'sold-products'].includes(categorySlug)) {
        let newPath = `/admin/${categorySlug}`;
        if (categorySlug === 'all-orders' && productSlug) { // abusing productSlug for invoiceId here
            newPath = `/admin/all-orders/${productSlug}`;
        }
        try {
            window.history.pushState({ path: newPath }, '', getBaseUri() + newPath.replace(/^\//, ''));
        } catch (e) {
            console.warn("pushState failed", e);
        }
        return;
    }

    let newPath;
    if (state.isAdmin) {
        // Admin mode: /admin/categorySlug/page-N or /admin/search/keyword
        if (categorySlug === 'search' && productSlug) {
            newPath = `/admin/search/${encodeURIComponent(productSlug)}`;
        } else {
            newPath = `/admin/${categorySlug}`;
            if (pageNum >= 1) {
                newPath += `/page-${pageNum}`;
            }
            if (productSlug && categorySlug !== 'search') {
                newPath += `/${productSlug}`;
            }
        }
    } else {
        newPath = `/${categorySlug}`;
        if (state.currentUser) {
            newPath = `/${state.currentUser.id}/${categorySlug}`;
        }
        if (pageNum >= 1) {
            newPath += `/page-${pageNum}`;
        }
        if (productSlug) {
            newPath += `/${productSlug}`;
        }
    }

    try {
        window.history.pushState({ path: getBaseUri() + newPath.replace(/^\//, '') }, '', getBaseUri() + newPath.replace(/^\//, ''));
    } catch (e) {
        console.warn("pushState failed, likely not running on a server.", e);
    }
}
window.updateUrlState = updateUrlState;

export function processRoute() {
    // Always clean up invoice view when navigating to a different page
    if (window.cleanupInvoiceView) window.cleanupInvoiceView();

    const bounceToRoot = () => {
        if (state.categories.length > 0) {
            state.currentCategorySlug = state.categories[0].slug;
            state.currentPage = 1;
            updateUrlState(state.currentCategorySlug, state.currentPage);
        }
    };

    const bounceToAdminRoot = () => {
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
    } else if (parts[0] === 'admin') {
        // === ADMIN URL ROUTING ===
        handleAdminRoute(parts, bounceToAdminRoot);
        return; // admin route handler takes care of rendering
    } else {
        // Deep link detection
        let maybeUser = parts[0];
        let rawAction = parts.length > 1 ? parts[1] : parts[0];
        let maybeAction = rawAction.toLowerCase();

        if (maybeAction === 'login' || maybeAction === 'register' || maybeAction === 'forgot') {
            if (state.categories.length > 0) state.currentCategorySlug = state.categories[0].slug;
            if (state.currentUser) {
                // Already authenticated, reject Auth prompt
                bounceToRoot();
            } else {
                // Open Auth Mode
                updateUrlState(maybeAction);
                if (window.openAuthModal) window.openAuthModal(maybeAction);
            }
        } else if (maybeAction === 'track' || rawAction === 'track') {
            // Track Order URL: /track or /track/CODE
            if (state.categories.length > 0) state.currentCategorySlug = state.categories[0].slug;
            
            const trackBtn = document.getElementById('nav-track-btn');
            if (trackBtn) trackBtn.click();
            
            // If URL has a tracking code /track/SFR123
            let trackingCode = null;
            if (maybeAction === 'track' && parts.length > 1) {
                trackingCode = decodeURIComponent(parts.slice(1).join('/'));
            } else if (rawAction === 'track' && parts.length > 2) {
                trackingCode = decodeURIComponent(parts.slice(2).join('/'));
            }

            if (trackingCode) {
                setTimeout(() => {
                    const input = document.getElementById('track-order-input');
                    const btn = document.getElementById('track-order-btn');
                    if (input && btn) {
                        input.value = trackingCode;
                        btn.click();
                    }
                }, 300);
            }
        } else if (maybeAction === 'authenticate-admin') {
            if (state.categories.length > 0) state.currentCategorySlug = state.categories[0].slug;
            if (state.isAdmin) {
                bounceToAdminRoot();
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
        } else if (maybeAction === 'checkout' || rawAction === 'checkout') {
            // Checkout URL: /userid/checkout or /guestname/checkout
            if (state.categories.length > 0) state.currentCategorySlug = state.categories[0].slug;
            // Mark as pending checkout — will be opened after products load
            window.pendingCheckout = true;
        } else if (maybeAction === 'search' || (parts.length === 2 && parts[0] === 'search')) {
            // --- Search URL routing ---
            let searchKeyword = null;

            if (parts[0] === 'search' && parts.length >= 2) {
                // /search/keyword — guest URL
                searchKeyword = decodeURIComponent(parts.slice(1).join('/'));
                if (state.currentUser) {
                    // Logged-in user accessing guest search URL — redirect to /userid/search/keyword
                    const newPath = `${state.currentUser.id}/search/${encodeURIComponent(searchKeyword)}`;
                    try {
                        window.history.replaceState({ path: getBaseUri() + newPath }, '', getBaseUri() + newPath);
                    } catch (e) { }
                }
            } else if (maybeAction === 'search' && parts.length >= 3) {
                // /userid/search/keyword — user URL
                searchKeyword = decodeURIComponent(parts.slice(2).join('/'));
                if (!state.currentUser) {
                    // Non-logged-in user accessing user search URL — redirect to /search/keyword
                    const newPath = `search/${encodeURIComponent(searchKeyword)}`;
                    try {
                        window.history.replaceState({ path: getBaseUri() + newPath }, '', getBaseUri() + newPath);
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
            // Check for Invoice URL: /userid/Orders/invoiceNumber
            if (rawAction === 'Orders' && parts.length === 3) {
                const orderId = parts[2];
                if (window.renderInvoicePage) {
                    window.renderInvoicePage(maybeUser, orderId);
                    return;
                }
            }

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

                try {
                    window.history.replaceState({ path: getBaseUri() + newPath.replace(/^\//, '') }, '', getBaseUri() + newPath.replace(/^\//, ''));
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
    } else if (window.pendingCheckout) {
        window.pendingCheckout = null;
        // Render products in background, then open checkout
        if (productViewSection) productViewSection.style.display = 'none';
        if (shopSection) shopSection.style.display = 'block';
        if (window.renderProducts && state.currentCategorySlug) {
            window.renderProducts(state.currentCategorySlug, 1);
        }
        // Open checkout after a short delay to let everything load
        setTimeout(() => {
            if (state.cart.length > 0 && window.openCheckoutView) {
                window.openCheckoutView();
            }
        }, 300);
    } else if (state.currentCategorySlug) {

        if (!window.location.pathname.includes('/Details') && !window.location.pathname.includes('/Orders')) {
            if (productViewSection) productViewSection.style.display = 'none';
            if (shopSection) shopSection.style.display = 'block';
        }

        if (window.renderProducts) window.renderProducts(state.currentCategorySlug, state.currentPage || 1);
    }
}
window.processRoute = processRoute;

// --- Admin Route Handler ---
function handleAdminRoute(parts, bounceToAdminRoot) {
    // parts[0] === 'admin'
    const adminSubParts = parts.slice(1); // everything after 'admin'

    if (!state.isAdmin) {
        // Not logged in as admin — store intended URL and redirect to auth
        const intendedPath = '/' + parts.join('/');
        sessionStorage.setItem('tc_admin_redirect', intendedPath);
        state.adminIntendedUrl = intendedPath;

        if (state.categories.length > 0) state.currentCategorySlug = state.categories[0].slug;
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
        if (window.renderCategoryTabs) window.renderCategoryTabs();
        return;
    }

    // Admin is logged in — parse the sub-route
    const productViewSection = document.getElementById('product-view');
    const shopSection = document.getElementById('shop');
    const checkoutView = document.getElementById('checkout-view');
    const adminOrdersView = document.getElementById('admin-orders-view');
    const mainLayoutContainer = document.getElementById('main-content');

    // Hide chat widget on admin pages
    const chatWidget = document.getElementById('floating-chat-widget');
    if (chatWidget) chatWidget.style.display = 'none';

    if (adminSubParts.length === 0) {
        // /admin — go to first category
        bounceToAdminRoot();
        if (window.renderCategoryTabs) window.renderCategoryTabs();
        if (mainLayoutContainer) mainLayoutContainer.style.display = 'block';
        if (checkoutView) checkoutView.style.display = 'none';
        if (adminOrdersView) adminOrdersView.style.display = 'none';
        if (productViewSection) productViewSection.style.display = 'none';
        if (shopSection) shopSection.style.display = 'block';
        if (window.renderProducts) window.renderProducts(state.currentCategorySlug, state.currentPage || 1);
        return;
    }

    const subPage = adminSubParts[0];

    if (subPage === 'search' && adminSubParts.length >= 2) {
        // /admin/search/keyword
        const searchKeyword = decodeURIComponent(adminSubParts.slice(1).join('/'));
        if (state.categories.length > 0) state.currentCategorySlug = state.categories[0].slug;
        if (window.renderCategoryTabs) window.renderCategoryTabs();
        if (mainLayoutContainer) mainLayoutContainer.style.display = 'block';
        if (checkoutView) checkoutView.style.display = 'none';
        if (adminOrdersView) adminOrdersView.style.display = 'none';
        if (productViewSection) productViewSection.style.display = 'none';
        if (shopSection) shopSection.style.display = 'block';

        // Trigger search
        setTimeout(() => {
            if (window.triggerSearchFromUrl) window.triggerSearchFromUrl(searchKeyword);
        }, 100);
        return;
    }

    if (subPage === 'all-orders') {
        // /admin/all-orders or /admin/all-orders/invoiceID
        if (adminSubParts.length >= 2) {
            const orderId = adminSubParts[1];
            if (window.renderInvoicePage) {
                window.renderInvoicePage('admin', orderId);
                return;
            }
        }

        // Default list view
        if (state.categories.length > 0) state.currentCategorySlug = state.categories[0].slug;
        if (window.renderCategoryTabs) window.renderCategoryTabs();
        if (mainLayoutContainer) mainLayoutContainer.style.display = 'none';
        if (checkoutView) checkoutView.style.display = 'none';
        if (adminOrdersView) adminOrdersView.style.display = 'block';
        if (productViewSection) productViewSection.style.display = 'none';
        if (shopSection) shopSection.style.display = 'none';

        // Highlight correct button
        const adminOrdersBtn = document.getElementById('admin-orders-btn');
        const adminUsersBtn = document.getElementById('admin-users-btn');
        const adminSoldProductsBtn = document.getElementById('admin-sold-products-btn');
        if (adminOrdersBtn) adminOrdersBtn.style.opacity = '1';
        if (adminUsersBtn) adminUsersBtn.style.opacity = '0.6';
        if (adminSoldProductsBtn) adminSoldProductsBtn.style.opacity = '0.6';

        if (window.loadAdminOrders) window.loadAdminOrders();
        return;
    }

    if (subPage === 'users-list') {
        // /admin/users-list
        if (state.categories.length > 0) state.currentCategorySlug = state.categories[0].slug;
        if (window.renderCategoryTabs) window.renderCategoryTabs();
        if (mainLayoutContainer) mainLayoutContainer.style.display = 'none';
        if (checkoutView) checkoutView.style.display = 'none';
        if (adminOrdersView) adminOrdersView.style.display = 'block';
        if (productViewSection) productViewSection.style.display = 'none';
        if (shopSection) shopSection.style.display = 'none';

        // Highlight correct button
        const adminOrdersBtn = document.getElementById('admin-orders-btn');
        const adminUsersBtn = document.getElementById('admin-users-btn');
        const adminSoldProductsBtn = document.getElementById('admin-sold-products-btn');
        if (adminUsersBtn) adminUsersBtn.style.opacity = '1';
        if (adminOrdersBtn) adminOrdersBtn.style.opacity = '0.6';
        if (adminSoldProductsBtn) adminSoldProductsBtn.style.opacity = '0.6';

        if (window.loadAdminUsers) window.loadAdminUsers();
        return;
    }

    if (subPage === 'sold-products') {
        // /admin/sold-products
        if (state.categories.length > 0) state.currentCategorySlug = state.categories[0].slug;
        if (window.renderCategoryTabs) window.renderCategoryTabs();
        if (mainLayoutContainer) mainLayoutContainer.style.display = 'none';
        if (checkoutView) checkoutView.style.display = 'none';
        if (adminOrdersView) adminOrdersView.style.display = 'block';
        if (productViewSection) productViewSection.style.display = 'none';
        if (shopSection) shopSection.style.display = 'none';

        // Highlight correct button
        const adminOrdersBtn = document.getElementById('admin-orders-btn');
        const adminSoldProductsBtn = document.getElementById('admin-sold-products-btn');
        if (adminSoldProductsBtn) adminSoldProductsBtn.style.opacity = '1';
        if (adminOrdersBtn) adminOrdersBtn.style.opacity = '0.6';

        if (window.renderAdminSoldProducts) window.renderAdminSoldProducts();
        return;
    }

    // /admin/categorySlug/page-N — category browsing in admin mode
    let targetCategory = subPage;
    let targetPage = 1;

    if (adminSubParts.length > 1 && adminSubParts[1].startsWith('page-')) {
        targetPage = parseInt(adminSubParts[1].split('-')[1]) || 1;
    }

    const catExists = state.categories.find(c => c.slug === targetCategory);
    if (!catExists) {
        showErrorPage(`Category "${targetCategory}" does not exist.`);
        return;
    }

    state.currentCategorySlug = targetCategory;
    state.currentPage = targetPage;

    if (window.renderCategoryTabs) window.renderCategoryTabs();
    if (mainLayoutContainer) mainLayoutContainer.style.display = 'block';
    if (checkoutView) checkoutView.style.display = 'none';
    if (adminOrdersView) adminOrdersView.style.display = 'none';
    if (productViewSection) productViewSection.style.display = 'none';
    if (shopSection) shopSection.style.display = 'block';

    if (window.renderProducts) window.renderProducts(state.currentCategorySlug, state.currentPage);
}

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

    // Ensure shop layout is visible if we aren't rendering a product or invoice
    if (!window.pendingProductSlug && !window.location.pathname.includes('/Details') && !window.location.pathname.includes('/Orders')) {
        if (!window.location.pathname.includes('/admin/all-orders') && !window.location.pathname.includes('/admin/users-list') && !window.location.pathname.includes('/admin/sold-products')) {
            if (productViewSection) productViewSection.style.display = 'none';
            if (shopSection) shopSection.style.display = 'block';
            const invoiceView = document.getElementById('invoice-view');
            if (invoiceView) invoiceView.style.display = 'none';
        }
    }
});
