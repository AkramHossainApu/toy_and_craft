console.log("APP.JS STARTING: Module evaluation has begun.");
import { state, setAdmin } from './core/state.js';
import { db, collection, getDocs } from './config/firebase.js';
import {
    homeTitle, homeSubtitle, siteTitle, shopSection, errorViewSection,
    mainLayoutContainer, errorMessageText, appLoader, navbar, mainContent
} from './core/dom.js';
import { generateSlug } from './core/utils.js';

import { setupAuthListeners, updateAuthUI } from './features/auth.js';
import { setupCartListeners, handleFirebaseCartSync } from './features/cart.js';
import { setupShopListeners, renderCategoryTabs, renderProducts } from './features/shop.js';
import { setupAdminListeners, setupAdminOrderListeners } from './features/admin.js';
import { initRouting } from './features/router.js';

import { getTrueDistrict } from './features/cart.js'; // Needed globally locally by forms

// --- Initialization sequence ---

async function fetchSiteMetadata() {
    try {
        const snap = await getDocs(collection(db, 'Settings'));
        snap.forEach(doc => {
            if (doc.id === 'SiteMetadata') {
                const data = doc.data();
                if (homeTitle && data.title) homeTitle.textContent = data.title;
                if (homeSubtitle && data.subtitle) homeSubtitle.textContent = data.subtitle;
            } else if (doc.id === 'DeliveryRules') {
                const data = doc.data();
                // Avoid polluting root prototype unless required, handled mostly inside cart calculation
                state.deliveryRules = data.Rules || {};
            }
        });
    } catch (err) {
        console.error("Failed to load metadata/delivery rules", err);
    }
}

async function fetchSteadfastLocations() {
    try {
        const locSnap = await getDocs(collection(db, 'SteadfastLocations'));
        locSnap.forEach(d => {
            state.steadfastLocations[d.id] = d.data().thanas || [];
        });
    } catch (e) {
        console.warn("Could not fetch location list", e);
    }
}

export async function fetchCategories() {
    try {
        const catSnap = await getDocs(collection(db, 'Products'));
        state.categories = catSnap.docs.map(doc => ({ id: doc.id, slug: doc.id.toLowerCase().replace(/ /g, '-'), ...doc.data() }));
        state.categories.sort((a, b) => (a.order || 0) - (b.order || 0));
        renderCategoryTabs();
    } catch (err) {
        console.error("Error fetching categories:", err);
        throw err;
    }
}

export async function fetchAllProducts() {
    try {
        const promises = state.categories.map(async (cat) => {
            const itemsSnap = await getDocs(collection(db, 'Products', cat.id, 'Items'));
            return itemsSnap.docs.map(doc => {
                const data = doc.data();
                return {
                    id: doc.id,
                    categoryId: cat.id,
                    categorySlug: cat.slug,
                    slug: data.name ? generateSlug(data.name) : doc.id.toLowerCase().replace(/ /g, '-'),
                    ...data
                };
            });
        });
        const results = await Promise.all(promises);
        state.inventory = results.flat();
    } catch (err) {
        console.error("Error fetching products:", err);
        throw err;
    }
}

document.addEventListener('DOMContentLoaded', async () => {
    console.log("APP.JS DOMContentLoaded: Initializing application...");
    // 1. Recover User session securely
    try {
        const localUser = localStorage.getItem('tc_user') || sessionStorage.getItem('tc_user');
        if (localUser) {
            state.currentUser = JSON.parse(localUser);
            await handleFirebaseCartSync(state.currentUser.id);
        } else {
            const localCart = localStorage.getItem('tc_cart');
            if (localCart) state.cart = JSON.parse(localCart);
            if (window.saveCart) window.saveCart(); // Syncs to UI
        }
    } catch (e) {
        console.error("Local session recovery failed", e);
    }

    // 2. Attach specialized listeners
    setupAuthListeners();
    setupCartListeners();
    setupShopListeners();
    setupAdminListeners();
    setupAdminOrderListeners();

    updateAuthUI();

    // 3. Global Error Recovery handler (Removed RetryBtn as it doesn't exist in HTML)

    // 4. Initial Bootstrap Data Fetch
    await fetchSteadfastLocations();
    fetchSiteMetadata(); // Non blocking

    try {
        await fetchCategories();
        await fetchAllProducts();
    } catch (err) {
        if (window.showErrorPage) window.showErrorPage("Failed to load store data. Please check your connection.");
        return; // Halt initialization if critical data fails
    }

    // 5. Initialize Routing Engine & Trigger Component Renders
    if (appLoader) appLoader.style.display = 'none';
    if (navbar) navbar.style.display = 'block';
    if (mainContent) mainContent.style.display = 'block';

    initRouting();
});
