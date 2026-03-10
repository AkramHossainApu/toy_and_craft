// --- Global Application State ---
// This file holds the mutable state replacing global `let` definitions in the old app.js

export const state = {
    inventory: [],
    inventoryUnsubscribers: [],
    categories: [],
    currentCategorySlug: '',
    cart: [],
    cartSelections: {}, // { productId: true/false } — tracks which items are selected for checkout
    isAdmin: sessionStorage.getItem('tc_admin') === 'true',

    // User Auth State
    currentUser: null, // { id: '...', name: '...', address: '...' }
    currentGuest: null, // { name: '...', mobile: '...', address: '...', district: '...', thana: '...' }

    // Database State
    steadfastLocations: {},
    deliveryRules: {},

    // Header State
    homeTitleText: localStorage.getItem('tc_home_title') || "Toy & Craft",
    homeTitleDefault: "Toy & Craft",
    homeSubtitleText: localStorage.getItem('tc_home_subtitle') || "Find the perfect mini brick set or a cute companion for your keys.",

    // Pagination & Navigation State
    currentPage: 1,
    itemsPerPage: 20,
    currentSort: 'default',
    routingInitialized: false,
    draggedCategorySlug: null,
    adminIntendedUrl: sessionStorage.getItem('tc_admin_redirect') || null
};

// State Mutators Ensure Reactivity where needed, or simply provide safe modification interfaces
export function updateCart(newCart) {
    state.cart = newCart;
    localStorage.setItem('tc_cart', JSON.stringify(state.cart));
}

export function setAdmin(status) {
    state.isAdmin = status;
    if (status) {
        sessionStorage.setItem('tc_admin', 'true');
    } else {
        sessionStorage.removeItem('tc_admin');
    }
}

// Logic migrated from header initial check
if (state.homeTitleText === "Pack & Wrap") {
    state.homeTitleText = "Toy & Craft";
    localStorage.setItem('tc_home_title', state.homeTitleText);
}
