import { state, setAdmin } from './core/state.js';
import { db, doc, getDoc, collection, getDocs, setDoc, increment } from './config/firebase.js';
import {
    homeTitle, homeSubtitle, siteTitle, shopSection, errorViewSection,
    mainLayoutContainer, errorMessageText, appLoader, navbar, mainContent, themeToggleBtn
} from './core/dom.js';
import { generateSlug } from './core/utils.js';

import { setupAuthListeners, updateAuthUI, initLocationDropdowns } from './features/auth.js?v=5';
import { setupCartListeners, handleFirebaseCartSync } from './features/cart.js?v=5';
import { setupShopListeners, renderCategoryTabs, renderProducts } from './features/shop.js?v=5';
import { setupAdminListeners, setupAdminOrderListeners, toggleAdminMode } from './features/admin.js?v=5';
import { setupSearchListeners } from './features/search.js?v=5';
import { renderInvoicePage, cleanupInvoiceView } from './features/invoice.js?v=5';
import { initRouting } from './features/router.js?v=5';
import { initTracking } from './features/tracking.js?v=5';

import { getTrueDistrict } from './features/cart.js?v=5'; // Needed globally locally by forms

// --- LocalStorage Cache Keys ---
const CACHE_KEY_CATEGORIES = 'tc_cache_categories';
const CACHE_KEY_PRODUCTS = 'tc_cache_products';
const CACHE_TTL = 5 * 60 * 1000; // 5 minutes

// --- Cache Helpers ---
function getCachedData(key) {
    try {
        const raw = localStorage.getItem(key);
        if (!raw) return null;
        const parsed = JSON.parse(raw);
        if (Date.now() - parsed.timestamp > CACHE_TTL) {
            localStorage.removeItem(key);
            return null;
        }
        return parsed.data;
    } catch (e) {
        return null;
    }
}

function setCachedData(key, data) {
    try {
        localStorage.setItem(key, JSON.stringify({ data, timestamp: Date.now() }));
    } catch (e) {
        // localStorage full or unavailable — ignore
    }
}

// --- Initialization sequence ---

async function fetchSiteMetadata() {
    try {
        const snap = await getDocs(collection(db, 'Settings'));
        snap.forEach(d => {
            if (d.id === 'SiteMetadata') {
                const data = d.data();
                if (data.site_name && siteTitle) siteTitle.textContent = data.site_name;
                if (data.title && homeTitle) homeTitle.textContent = data.title;
                if (data.subtitle && homeSubtitle) homeSubtitle.textContent = data.subtitle;
                document.title = data.site_name || "Toy & Craft";
            } else if (d.id === 'DeliveryRules') {
                const data = d.data();
                state.deliveryRules = data.Rules || {};
            }
        });
    } catch (err) {
        console.error("Failed to load metadata/delivery rules", err);
    }
}

async function fetchSteadfastLocations() {
    try {
        const locDocRef = doc(db, 'Settings', 'Locations');
        const locSnap = await getDoc(locDocRef);

        if (locSnap.exists()) {
            const docData = locSnap.data();
            const locationData = docData.data || docData;
            for (const district in locationData) {
                if (Array.isArray(locationData[district])) {
                    state.steadfastLocations[district] = locationData[district];
                } else if (typeof locationData[district] === 'object' && locationData[district].thanas) {
                    state.steadfastLocations[district] = locationData[district].thanas;
                }
            }
        }
    } catch (e) {
        console.warn("Could not fetch location list", e);
    }
}

export async function fetchCategories({ silent = false } = {}) {
    try {
        const catSnap = await getDocs(collection(db, 'Products'));
        state.categories = catSnap.docs.map(doc => ({ id: doc.id, slug: doc.id.toLowerCase().replace(/ /g, '-'), ...doc.data() }));
        state.categories.sort((a, b) => (a.order || 0) - (b.order || 0));

        // Cache for next visit
        setCachedData(CACHE_KEY_CATEGORIES, state.categories);

        // Only re-render tabs on initial load, not during background refresh
        if (!silent) renderCategoryTabs();
    } catch (err) {
        console.error("Error fetching categories:", err);
        throw err;
    }
}

export async function fetchAllProducts({ silent = false } = {}) {
    try {
        if (state.categories.length === 0) return;

        // Helper to fetch a single category's products
        const fetchCategoryProducts = async (cat) => {
            const itemsSnap = await getDocs(collection(db, 'Products', cat.id, 'Items'));
            return itemsSnap.docs.map(doc => {
                const data = doc.data();
                return {
                    ...data,
                    id: doc.id,
                    categoryId: cat.id,
                    categorySlug: cat.slug,
                    slug: data.name ? generateSlug(data.name) : doc.id.toLowerCase().replace(/ /g, '-')
                };
            });
        };

        // SILENT MODE (background refresh): Fetch everything, then replace atomically
        if (silent) {
            const allPromises = state.categories.map(cat => fetchCategoryProducts(cat));
            const allResults = await Promise.all(allPromises);
            state.inventory = allResults.flat();
            state.inventoryFullyLoaded = true;
            setCachedData(CACHE_KEY_PRODUCTS, state.inventory);
            return;
        }

        // NORMAL MODE (initial load): Priority-first progressive loading
        state.inventoryFullyLoaded = false;

        // Determine the priority category to load first (from URL path)
        let prioritySlug = state.categories[0].slug;
        const basePath = window.location.pathname.startsWith('/toy_and_craft') ? '/toy_and_craft/' : '/';
        const pathParts = window.location.pathname.replace(basePath, '').split('/').filter(p => p);
        
        // Search ALL path parts for a matching category slug
        for (const part of pathParts) {
            if (state.categories.find(c => c.slug === part)) {
                prioritySlug = part;
                break;
            }
        }
        
        const priorityCat = state.categories.find(c => c.slug === prioritySlug);
        
        // 1. Fetch the PRIORITY category first and wait for it (unblocks initial render)
        state.inventory = await fetchCategoryProducts(priorityCat);

        // 2. Fetch remaining categories in parallel — each one renders as it arrives
        const otherCats = state.categories.filter(c => c.slug !== prioritySlug);
        
        if (otherCats.length > 0) {
            const fetchAndAppend = async (cat) => {
                try {
                    const products = await fetchCategoryProducts(cat);
                    state.inventory = [...state.inventory, ...products];
                    if (state.currentCategorySlug === cat.slug && window.renderProducts) {
                        window.renderProducts(state.currentCategorySlug, state.currentPage || 1);
                    }
                } catch (catErr) {
                    console.error(`Failed to fetch products for ${cat.slug}:`, catErr);
                }
            };

            Promise.all(otherCats.map(cat => fetchAndAppend(cat)))
                .then(() => {
                    state.inventoryFullyLoaded = true;
                    setCachedData(CACHE_KEY_PRODUCTS, state.inventory);
                })
                .catch(() => {
                    state.inventoryFullyLoaded = true;
                });
        } else {
            state.inventoryFullyLoaded = true;
            setCachedData(CACHE_KEY_PRODUCTS, state.inventory);
        }

    } catch (err) {
        console.error("Error fetching products:", err);
        throw err;
    }
}

document.addEventListener('DOMContentLoaded', async () => {
    // ============================================================
    // PHASE 0: INSTANT — Use cached local data + local session (NO network)
    // ============================================================

    // Session recovery from localStorage (instant, no Firestore)
    try {
        const localUser = localStorage.getItem('tc_user') || sessionStorage.getItem('tc_user');
        if (localUser) {
            state.currentUser = JSON.parse(localUser);
        }
        const localCart = localStorage.getItem('tc_cart');
        if (localCart) {
            state.cart = JSON.parse(localCart);
            if (window.saveCart) window.saveCart();
        }
    } catch (e) {
        console.error("Local session recovery failed", e);
    }

    // Attach listeners (synchronous, instant)
    setupAuthListeners();
    setupCartListeners();
    setupShopListeners();
    setupAdminListeners();
    setupAdminOrderListeners();
    try { setupSearchListeners(); } catch (e) { console.error("Search init failed", e); }
    initTracking();

    // Theme toggle (instant)
    if (themeToggleBtn) {
        if (localStorage.getItem('tc_theme') === 'dark') {
            document.documentElement.setAttribute('data-theme', 'dark');
            themeToggleBtn.innerHTML = '<span class="material-icons-round">light_mode</span>';
        }
        themeToggleBtn.addEventListener('click', () => {
            const currentTheme = document.documentElement.getAttribute('data-theme');
            const newTheme = currentTheme === 'dark' ? 'light' : 'dark';
            if (newTheme === 'dark') {
                document.documentElement.setAttribute('data-theme', 'dark');
            } else {
                document.documentElement.removeAttribute('data-theme');
            }
            localStorage.setItem('tc_theme', newTheme);
            themeToggleBtn.innerHTML = newTheme === 'dark' ?
                '<span class="material-icons-round">light_mode</span>' :
                '<span class="material-icons-round">dark_mode</span>';
        });
    }

    if (state.isAdmin) {
        toggleAdminMode(true);
    }

    // Logo click handler (instant)
    const logoEl = document.querySelector('.logo');
    if (logoEl) {
        logoEl.addEventListener('click', () => {
            const productViewSection = document.getElementById('product-view');
            const errorViewSection = document.getElementById('error-view');
            const checkoutViewEl = document.getElementById('checkout-view');
            const adminOrdersView = document.getElementById('admin-orders-view');
            const mainContentEl = document.getElementById('main-content');
            const shopEl = document.getElementById('shop');

            if (productViewSection) productViewSection.style.display = 'none';
            if (errorViewSection) errorViewSection.style.display = 'none';
            if (checkoutViewEl) checkoutViewEl.style.display = 'none';
            if (adminOrdersView) adminOrdersView.style.display = 'none';
            if (mainContentEl) mainContentEl.style.display = 'block';
            if (shopEl) shopEl.style.display = 'block';

            if (state.categories.length > 0) {
                state.currentCategorySlug = state.categories[0].slug;
                state.currentPage = 1;
                if (window.updateUrlState) window.updateUrlState(state.currentCategorySlug, 1);
                if (window.renderCategoryTabs) window.renderCategoryTabs();
                if (window.renderProducts) window.renderProducts(state.currentCategorySlug, 1);
            }
        });
    }

    updateAuthUI();

    // ============================================================
    // PHASE 1: TRY CACHE — Show cached data instantly if available
    // ============================================================
    const cachedCategories = getCachedData(CACHE_KEY_CATEGORIES);
    const cachedProducts = getCachedData(CACHE_KEY_PRODUCTS);
    let usedCache = false;

    if (cachedCategories && cachedCategories.length > 0 && cachedProducts && cachedProducts.length > 0) {
        state.categories = cachedCategories;
        state.inventory = cachedProducts;
        state.inventoryFullyLoaded = true;

        renderCategoryTabs();

        // Show page immediately from cache
        if (appLoader) appLoader.style.display = 'none';
        if (navbar) navbar.style.display = 'block';
        if (mainContent) mainContent.style.display = 'block';
        initRouting();
        usedCache = true;

        // Refresh data in background (stale-while-revalidate)
        // silent: true prevents destructive state overwrites and tab re-renders
        fetchCategories({ silent: true })
            .then(() => fetchAllProducts({ silent: true }))
            .catch(err => console.error("Background refresh failed:", err));
    }

    // ============================================================
    // PHASE 2: NETWORK — Only the critical path (categories + products)
    // ============================================================
    if (!usedCache) {
        try {
            // ONLY wait for categories + products — the absolute minimum to show the page
            await fetchCategories();
            await fetchAllProducts();
        } catch (err) {
            console.error("APP INITIALIZATION ERROR:", err);
            const { showErrorPage } = await import('./core/utils.js');
            showErrorPage("Application failed to load critical data. Please check your internet connection.");
            return;
        }

        // Show the page NOW
        if (appLoader) appLoader.style.display = 'none';
        if (navbar) navbar.style.display = 'block';
        if (mainContent) mainContent.style.display = 'block';
        initRouting();
    }

    // ============================================================
    // PHASE 3: BACKGROUND — Everything else loads without blocking
    // ============================================================

    // Analytics tracking (fire-and-forget)
    if (!state.isAdmin && !sessionStorage.getItem('tc_visited_today')) {
        const today = new Date().toISOString().split('T')[0];
        setDoc(doc(db, 'Analytics', `Visits_${today}`), {
            date: today,
            views: increment(1)
        }, { merge: true })
            .then(() => sessionStorage.setItem('tc_visited_today', 'true'))
            .catch(e => console.warn('Analytics tracking failed', e));
    }

    // Metadata + site title (non-blocking, updates text when ready)
    fetchSiteMetadata().catch(e => console.warn('Metadata fetch failed', e));

    // Locations (only needed at checkout, non-blocking)
    fetchSteadfastLocations()
        .then(() => initLocationDropdowns())
        .catch(e => console.warn('Location fetch failed', e));

    // Refresh user data from Firestore + sync cart (non-blocking)
    if (state.currentUser) {
        (async () => {
            try {
                const userSnap = await getDoc(doc(db, 'Users', state.currentUser.id));
                if (userSnap.exists()) {
                    const data = userSnap.data();
                    state.currentUser = {
                        id: userSnap.id,
                        name: data.username || '',
                        email: data.email || '',
                        mobile: data.mobile || '',
                        address: data.address || '',
                        district: data.district || '',
                        thana: data.thana || ''
                    };
                    const storage = localStorage.getItem('tc_user') ? localStorage : sessionStorage;
                    storage.setItem('tc_user', JSON.stringify(state.currentUser));
                    updateAuthUI();
                }
                await handleFirebaseCartSync(state.currentUser.id);
            } catch (err) {
                console.error("Background user/cart sync failed", err);
            }
        })();
    }

    // Floating Chat Widget Toggle
    const chatWidget = document.getElementById('floating-chat-widget');
    const chatToggleBtn = document.getElementById('chat-toggle-btn');
    if (chatWidget && chatToggleBtn) {
        chatToggleBtn.addEventListener('click', () => {
            chatWidget.classList.toggle('active');
        });
        document.addEventListener('click', (e) => {
            if (!chatWidget.contains(e.target) && chatWidget.classList.contains('active')) {
                chatWidget.classList.remove('active');
            }
        });
    }

    // Promo Banner Close Logic
    const promoBanner = document.getElementById('promo-banner');
    const closePromoBtn = document.getElementById('close-promo-btn');
    if (promoBanner && closePromoBtn) {
        if (sessionStorage.getItem('tc_promo_closed') === 'true') {
            promoBanner.style.display = 'none';
        }
        closePromoBtn.addEventListener('click', () => {
            promoBanner.style.opacity = '0';
            promoBanner.style.transition = 'opacity 0.3s ease';
            setTimeout(() => {
                promoBanner.style.display = 'none';
                sessionStorage.setItem('tc_promo_closed', 'true');
            }, 300);
        });
    }
});
