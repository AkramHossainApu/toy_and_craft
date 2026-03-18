import { state, setAdmin } from './core/state.js';
import { db, doc, getDoc, collection, getDocs } from './config/firebase.js';
import {
    homeTitle, homeSubtitle, siteTitle, shopSection, errorViewSection,
    mainLayoutContainer, errorMessageText, appLoader, navbar, mainContent, themeToggleBtn
} from './core/dom.js';
import { generateSlug } from './core/utils.js';

import { setupAuthListeners, updateAuthUI, initLocationDropdowns } from './features/auth.js';
import { setupCartListeners, handleFirebaseCartSync } from './features/cart.js';
import { setupShopListeners, renderCategoryTabs, renderProducts } from './features/shop.js';
import { setupAdminListeners, setupAdminOrderListeners, toggleAdminMode } from './features/admin.js';
import { setupSearchListeners } from './features/search.js';
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
        const locDocRef = doc(db, 'Settings', 'Locations');
        const locSnap = await getDoc(locDocRef);

        if (locSnap.exists()) {
            const docData = locSnap.data();
            const locationData = docData.data || docData;
            console.log("PAYLOAD_DUMP:", JSON.stringify(locationData));
            for (const district in locationData) {
                // Ignore any internal Firebase meta keys if they exist
                if (Array.isArray(locationData[district])) {
                    state.steadfastLocations[district] = locationData[district];
                } else if (typeof locationData[district] === 'object' && locationData[district].thanas) {
                    state.steadfastLocations[district] = locationData[district].thanas;
                }
            }
        } else {
            console.warn("Settings/Locations document is missing from Firebase.");
        }
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
                    ...data,
                    id: doc.id,
                    categoryId: cat.id,
                    categorySlug: cat.slug,
                    slug: data.name ? generateSlug(data.name) : doc.id.toLowerCase().replace(/ /g, '-')
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
    // 0. Session Recovery & Auth Logic
    try {
        const localUser = localStorage.getItem('tc_user') || sessionStorage.getItem('tc_user');
        if (localUser) {
            const parsed = JSON.parse(localUser);
            // Refresh user data from Firestore to ensure all fields (like email) are present
            try {
                const userSnap = await getDoc(doc(db, 'Users', parsed.id));
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
                    // Update storage with fresh data
                    const storage = localStorage.getItem('tc_user') ? localStorage : sessionStorage;
                    storage.setItem('tc_user', JSON.stringify(state.currentUser));
                } else {
                    state.currentUser = parsed;
                }
            } catch (err) {
                console.error("Failed to refresh user data", err);
                state.currentUser = parsed;
            }
            await handleFirebaseCartSync(state.currentUser.id);
        } else {
            const localCart = localStorage.getItem('tc_cart');
            if (localCart) state.cart = JSON.parse(localCart);
            if (window.saveCart) window.saveCart(); // Syncs to UI
        }
    } catch (e) {
        console.error("Local session recovery failed", e);
    }

    // 1. Attach specialized listeners
    setupAuthListeners();
    setupCartListeners();
    setupShopListeners();
    setupAdminListeners();
    setupAdminOrderListeners();
    setupSearchListeners();

    // 2. Initialize Visual Toggles & Stored Global States
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

    // Logo/Title click → navigate to home
    const logoEl = document.querySelector('.logo');
    if (logoEl) {
        logoEl.addEventListener('click', () => {
            // Hide any open views
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

            // Navigate to first category
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

    // 3. Critical Data Fetching (Parallelized)
    try {
        const fetchMetadata = async () => {
            const metaSnap = await getDoc(doc(db, 'Settings', 'SiteMetadata'));
            if (metaSnap.exists()) {
                const data = metaSnap.data();
                // Only update navbar title if site_name exists, otherwise keep Toy & Craft
                if (data.site_name && siteTitle) {
                    siteTitle.textContent = data.site_name;
                } else if (siteTitle) {
                    siteTitle.textContent = "Toy & Craft";
                }

                if (data.title && homeTitle) homeTitle.textContent = data.title;
                if (data.subtitle && homeSubtitle) homeSubtitle.textContent = data.subtitle;
                
                // Tab title should be the brand name
                document.title = data.site_name || "Toy & Craft";
            }
        };

        // Parallel fetch for critical data
        await Promise.all([
            fetchMetadata(),
            fetchCategories().then(() => fetchAllProducts()),
            fetchSteadfastLocations().then(() => {
                initLocationDropdowns();
            })
        ]);

    } catch (err) {
        console.error("APP INITIALIZATION ERROR:", err);
        showErrorPage("Application failed to load critical data. Please check your internet connection.");
        return; // Halt initialization if critical data fails
    }

    // 4. Initialize Routing Engine & Trigger Component Renders
    if (appLoader) appLoader.style.display = 'none';
    if (navbar) navbar.style.display = 'block';
    if (mainContent) mainContent.style.display = 'block';

    // Floating Chat Widget Toggle
    const chatWidget = document.getElementById('floating-chat-widget');
    const chatToggleBtn = document.getElementById('chat-toggle-btn');
    if (chatWidget && chatToggleBtn) {
        chatToggleBtn.addEventListener('click', () => {
            chatWidget.classList.toggle('active');
        });

        // Close when clicking outside
        document.addEventListener('click', (e) => {
            if (!chatWidget.contains(e.target) && chatWidget.classList.contains('active')) {
                chatWidget.classList.remove('active');
            }
        });
    }

    initRouting();
});
