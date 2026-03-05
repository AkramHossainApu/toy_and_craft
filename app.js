import { initializeApp } from "https://www.gstatic.com/firebasejs/10.12.2/firebase-app.js";
import {
    getFirestore, collection, doc, setDoc, deleteDoc, updateDoc,
    onSnapshot, getDocs, getDoc, query, where, writeBatch, runTransaction
} from "https://www.gstatic.com/firebasejs/10.12.2/firebase-firestore.js";


const firebaseConfig = {
    apiKey: "AIzaSyARQW48lm5jEavNwCDG7tKlolxJPg1ggLg",
    authDomain: "toyandcraftstore.firebaseapp.com",
    projectId: "toyandcraftstore",
    storageBucket: "toyandcraftstore.firebasestorage.app",
    messagingSenderId: "732577086084",
    appId: "1:732577086084:web:9f5db5dce1491124aaa0d1"
};

const app = initializeApp(firebaseConfig);
const db = getFirestore(app);

// --- State Variables ---
let inventory = [];
let inventoryUnsubscribers = [];
let categories = [];
let currentCategorySlug = '';
let cart = JSON.parse(localStorage.getItem('tc_cart')) || [];
let isAdmin = sessionStorage.getItem('tc_admin') === 'true';

// User Auth State
let currentUser = null; // { id: '...', name: '...', address: '...' }
let currentGuest = null; // { name: '...', mobile: '...', address: '...', district: '...', thana: '...' }

// Database State
let steadfastLocations = {};
let deliveryRules = {};

// Header State
let homeTitleText = localStorage.getItem('tc_home_title');
if (homeTitleText === "Pack & Wrap") {
    homeTitleText = "Toy & Craft";
    localStorage.setItem('tc_home_title', homeTitleText);
} else if (!homeTitleText) {
    homeTitleText = "Toy & Craft";
}
let homeTitleDefault = "Toy & Craft";
let homeSubtitleText = localStorage.getItem('tc_home_subtitle') || "Find the perfect mini brick set or a cute companion for your keys.";

// --- DOM Layout Elements ---
const productGrid = document.getElementById('product-grid');
const categoryTabsContainer = document.querySelector('.category-tabs');
const cartToggleBtn = document.getElementById('cart-toggle');
const cartSidebar = document.getElementById('cart-sidebar');
const cartOverlay = document.getElementById('cart-overlay');
const closeCartBtn = document.getElementById('close-cart');
const cartItemsContainer = document.getElementById('cart-items');
const cartTotalPrice = document.getElementById('cart-total-price');
const cartBadge = document.getElementById('cart-badge');
const themeToggleBtn = document.getElementById('theme-toggle');

// Navigation User Profile Elements
const authLoginBtn = document.getElementById('auth-login-btn');
const userProfileBadge = document.getElementById('user-profile-badge');
const userProfileName = document.getElementById('user-profile-name');

// Auth Modal Elements
const authModal = document.getElementById('auth-modal');
const authModalTitle = document.getElementById('auth-modal-title');
const closeAuthModalBtn = document.getElementById('close-auth-modal');

// Views
const loginView = document.getElementById('login-view');
const registerView = document.getElementById('register-view');
const profileView = document.getElementById('profile-view');

// Login Form Elements
const loginForm = document.getElementById('login-form');
const loginIdentifierInput = document.getElementById('login-identifier');
const loginPasswordInput = document.getElementById('login-password');
const loginRememberInput = document.getElementById('login-remember');
const loginSubmitBtn = document.getElementById('login-submit-btn');
const showRegisterBtn = document.getElementById('show-register-btn');

// Register Form Elements
const registerForm = document.getElementById('register-form');
const registerUsernameInput = document.getElementById('register-username');
const registerUseridInput = document.getElementById('register-userid');
const registerMobileInput = document.getElementById('register-mobile');
const registerPasswordInput = document.getElementById('register-password');
const registerAddressInput = document.getElementById('register-address');
const registerDistrictInput = document.getElementById('register-district');
const registerThanaInput = document.getElementById('register-thana');
const registerRememberInput = document.getElementById('register-remember');
const registerSubmitBtn = document.getElementById('register-submit-btn');
const showLoginBtn = document.getElementById('show-login-btn');

// Profile Form Elements
const profileForm = document.getElementById('profile-form');
const profileUsernameInput = document.getElementById('profile-username');
const profileUseridInput = document.getElementById('profile-userid');
const profileMobileInput = document.getElementById('profile-mobile');
const profileAddressInput = document.getElementById('profile-address');
const profileDistrictInput = document.getElementById('profile-district');
const profileThanaInput = document.getElementById('profile-thana');
const profileOrdersList = document.getElementById('profile-orders-list');
const profileUpdateBtn = document.getElementById('profile-update-btn');
const authLogoutBtn = document.getElementById('auth-logout-btn');

// Admin Elements
const siteTitle = document.getElementById('site-title');
const adminToolsBanner = document.getElementById('admin-tools-banner');
const adminNavbarLogoutBtn = document.getElementById('admin-navbar-logout-btn');
const homeTitle = document.getElementById('home-title');
const homeSubtitle = document.getElementById('home-subtitle');
const adminHeaderEditContainer = document.getElementById('admin-header-edit-container');
const adminEditHeaderBtn = document.getElementById('admin-edit-header-btn');

// Checkout View Elements
const checkoutView = document.getElementById('checkout-view');
const checkoutUserDetails = document.getElementById('checkout-user-details');
const checkoutItemsList = document.getElementById('checkout-items-list');
const checkoutSubtotalPrice = document.getElementById('checkout-subtotal-price');
const checkoutDeliveryCharge = document.getElementById('checkout-delivery-charge');
const checkoutTotalPrice = document.getElementById('checkout-total-price');

// Guest Modal Elements
const guestModal = document.getElementById('guest-modal');
const closeGuestModalBtn = document.getElementById('close-guest-modal');
const guestCheckoutForm = document.getElementById('guest-checkout-form');
const guestNameInput = document.getElementById('guest-name');
const guestMobileInput = document.getElementById('guest-mobile');
const guestAddressInput = document.getElementById('guest-address');
const guestDistrict = document.getElementById('guest-district');
const guestThana = document.getElementById('guest-thana');
const guestModalLoginLink = document.getElementById('guest-modal-login-link');


const checkoutConfirmBtn = document.getElementById('checkout-confirm-btn');
const checkoutCancelBtn = document.getElementById('checkout-cancel-btn');
const mainLayoutContainer = document.querySelector('main'); // Target standard HTML body to toggle vis

// Header Form Modal
const headerModal = document.getElementById('header-modal');
const closeHeaderModalBtn = document.getElementById('close-header-modal');
const headerCancelBtn = document.getElementById('header-cancel-btn');
const adminHeaderForm = document.getElementById('admin-header-form');
const adminHeaderTitleInput = document.getElementById('admin-header-title');
const adminHeaderSubtitleInput = document.getElementById('admin-header-subtitle');

// Password Modal Elements
const passwordModal = document.getElementById('password-modal');
const passwordModalTitle = document.getElementById('password-modal-title');
const passwordInput = document.getElementById('password-input');
const passwordSubmitBtn = document.getElementById('password-submit-btn');
const passwordCancelBtn = document.getElementById('password-cancel-btn');

// Admin Product Form Modal Elements
const adminModal = document.getElementById('admin-modal');
const closeAdminModal = document.getElementById('close-admin-modal');
const adminCancelBtn = document.getElementById('admin-cancel-btn');
const adminProductForm = document.getElementById('admin-product-form');
const adminModalTitle = document.getElementById('admin-modal-title');
const adminProductId = document.getElementById('admin-product-id');
const adminProductName = document.getElementById('admin-product-name');
const adminProductCategory = document.getElementById('admin-product-category');
const adminProductPrice = document.getElementById('admin-product-price');
const adminProductOffer = document.getElementById('admin-product-offer');
const adminProductImage = document.getElementById('admin-product-image');
const adminProductNew = document.getElementById('admin-product-new');
const adminProductSale = document.getElementById('admin-product-sale');

// Category Form Modal Elements
const categoryModal = document.getElementById('category-modal');
const closeCategoryModalBtn = document.getElementById('close-category-modal');
const categoryCancelBtn = document.getElementById('category-cancel-btn');
const categoryForm = document.getElementById('category-form');
const newCategoryNameInput = document.getElementById('new-category-name');

// --- Initialization ---
document.addEventListener('DOMContentLoaded', () => {
    toggleAdminMode(isAdmin);

    const errView = document.getElementById('error-view');
    if (errView) errView.style.display = 'none';

    // Check local storage for persistent user session
    const savedUser = localStorage.getItem('tc_user') || sessionStorage.getItem('tc_user');
    if (savedUser) {
        currentUser = JSON.parse(savedUser);
        updateAuthUI();
        handleFirebaseCartSync(currentUser.id);
    }

    startFirebaseSync();
    updateCartUI();
});

// --- Firebase Real-Time Sync ---
function generateSlug(name) {
    return name.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/(^-|-$)/g, '');
}

function getAbsoluteImageUrl(img) {
    if (!img) return '/assets/placeholder.jpg';
    if (img.startsWith('http') || img.startsWith('//') || img.startsWith('data:')) return img;
    return img.startsWith('/') ? img : '/' + img;
}

function startFirebaseSync() {
    onSnapshot(collection(db, 'Products'), (snapshot) => {
        // Filter out leaked product documents that might accidentally be in the root Products collection
        categories = snapshot.docs
            .filter(docSnap => {
                const data = docSnap.data();
                // A valid category doc should not have a 'price' or 'image' field
                return data.price === undefined && data.image === undefined;
            })
            .map(docSnap => ({
                id: docSnap.id,
                slug: generateSlug(docSnap.id),
                order: docSnap.data().order || 0
            }))
            .sort((a, b) => a.order - b.order);

        if (categories.length > 0) {
            // Run deep linking parsing only once at boot
            if (!currentCategorySlug) {
                initRouting();
            } else {
                renderCategoryTabs();
                loadInventoryItems();
            }
        }
    });

    // Real-time listener for Site Header Metadata
    onSnapshot(doc(db, 'Settings', 'SiteMetadata'), (docSnap) => {
        if (docSnap.exists()) {
            const data = docSnap.data();
            if (homeTitle) homeTitle.textContent = data.title || 'Toy & Craft';
            if (homeSubtitle) homeSubtitle.textContent = data.subtitle || 'Premium Miniature Collections';
        } else {
            // Apply safe defaults if the document hasn't been created yet
            if (homeTitle) homeTitle.textContent = 'Toy & Craft';
            if (homeSubtitle) homeSubtitle.textContent = 'Premium Miniature Collections';
        }
    });

    // Real-time listener for Locations Dropdowns
    onSnapshot(doc(db, 'Settings', 'Locations'), (docSnap) => {
        if (docSnap.exists()) {
            steadfastLocations = docSnap.data().data || {};
            // If they are on the register/profile form right now, re-init the dropdowns
            if (Object.keys(steadfastLocations).length > 0) {
                initLocationDropdowns();
            }
        }
    });

    // Real-time listener for Delivery Rules
    onSnapshot(doc(db, 'Settings', 'DeliveryRules'), (docSnap) => {
        if (docSnap.exists()) {
            deliveryRules = docSnap.data() || {};
        }
    });
}

function loadInventoryItems() {
    // Unsubscribe previous listeners to prevent duplicates
    inventoryUnsubscribers.forEach(unsub => unsub());
    inventoryUnsubscribers = [];
    inventory = []; // Reset local inventory array

    categories.forEach(cat => {
        const unsub = onSnapshot(collection(db, 'Products', cat.id, 'Items'), (snapshot) => {
            // Remove old items for this specific category from local state
            inventory = inventory.filter(p => p.categoryId !== cat.id);

            // Add updated items
            snapshot.forEach(docSnap => {
                const data = docSnap.data();
                inventory.push({
                    id: docSnap.id,
                    categoryId: cat.id,
                    categorySlug: cat.slug,
                    name: data.name,
                    slug: generateSlug(data.name || docSnap.id),
                    description: data.description || '',
                    images: data.images || [],
                    price: parseFloat(data.price),
                    offerPrice: data.offerPrice ? parseFloat(data.offerPrice) : null,
                    image: data.image,
                    isNew: data.isNew || false,
                    isSale: data.isSale || false,
                    stock: data.stock
                });
            });

            // Re-render the grid if we are currently looking at this category
            if (cat.slug === currentCategorySlug && (!window.pendingProductSlug || shopSection.style.display !== 'none')) {
                renderProducts(currentCategorySlug, currentPage);
            }

            if (window.pendingProductSlug && inventory.some(p => p.slug === window.pendingProductSlug && p.categorySlug === cat.slug)) {
                window.renderProductPage(window.pendingProductSlug);
                window.pendingProductSlug = null; // Consume
            } else if (window.pendingProductSlug && cat.slug === currentCategorySlug) {
                window.showErrorPage(`The page or product you are looking for doesn't exist or has been moved.`);
                window.pendingProductSlug = null; // Consume
            }

            updateCartUI(); // Update prices dynamically in the cart
        });
        inventoryUnsubscribers.push(unsub);
    });
}

// --- Category Drag and Drop Functions ---
let draggedCategorySlug = null;

function handleDragStart(e) {
    draggedCategorySlug = e.target.getAttribute('data-category');
    e.dataTransfer.effectAllowed = 'move';
    setTimeout(() => e.target.classList.add('dragging'), 0);
}

function handleDragOver(e) {
    e.preventDefault();
    e.dataTransfer.dropEffect = 'move';
}

function handleDragEnter(e) {
    e.preventDefault();
    if (e.target.classList.contains('tab-btn') && !e.target.classList.contains('add-category-btn')) {
        e.target.classList.add('drag-over');
    }
}

function handleDragLeave(e) {
    e.target.classList.remove('drag-over');
}

async function handleDrop(e) {
    e.stopPropagation();
    e.preventDefault();
    e.target.classList.remove('drag-over');

    // We try to grab the slug from what we dropped on. If dropped exactly on text, might need closest
    const targetElement = e.target.closest('.tab-btn');
    if (!targetElement) return;

    const targetSlug = targetElement.getAttribute('data-category');

    document.querySelectorAll('.tab-btn').forEach(btn => btn.classList.remove('dragging', 'drag-over'));

    if (draggedCategorySlug && targetSlug && draggedCategorySlug !== targetSlug) {
        const oldIndex = categories.findIndex(c => c.slug === draggedCategorySlug);
        const newIndex = categories.findIndex(c => c.slug === targetSlug);

        if (oldIndex > -1 && newIndex > -1) {
            // Re-order array in place
            const [movedItem] = categories.splice(oldIndex, 1);
            categories.splice(newIndex, 0, movedItem);

            // Re-assign order based on immediate new indices
            categories.forEach((cat, idx) => {
                cat.order = idx;
            });

            renderCategoryTabs();

            // Batch push updates to Firestore
            try {
                const batch = writeBatch(db);
                categories.forEach(cat => {
                    batch.update(doc(db, 'Products', cat.id), { order: cat.order });
                });
                await batch.commit();
            } catch (err) {
                console.error("Error updating sort order", err);
            }
        }
    }
    draggedCategorySlug = null;
}

// --- UI Rendering ---
function getCategoryNameFromSlug(slug) {
    const cat = categories.find(c => c.slug === slug);
    return cat ? cat.id : slug;
}

function renderCategoryTabs() {
    if (!categoryTabsContainer) return;
    categoryTabsContainer.innerHTML = '';

    if (categories.length === 0) {
        // Fallback info
        const msg = document.createElement('span');
        msg.className = 'text-muted';
        msg.textContent = 'No categories found.';
        categoryTabsContainer.appendChild(msg);
    } else {
        // Ensure currentCategorySlug is valid
        if (!categories.find(c => c.slug === currentCategorySlug)) {
            currentCategorySlug = categories[0].slug;
        }

        categories.forEach(cat => {
            const btn = document.createElement('button');
            btn.className = `tab-btn ${cat.slug === currentCategorySlug ? 'active' : ''}`;
            btn.setAttribute('data-category', cat.slug);
            btn.textContent = cat.id;

            if (isAdmin) {
                btn.draggable = true;
                btn.classList.add('draggable-tab');

                // Add Delete Btn overlay to Admin Tabs
                const delBtn = document.createElement('button');
                delBtn.className = 'delete-category-btn';
                delBtn.innerHTML = '<span class="material-icons-round" style="font-size: 14px;">delete</span>';
                delBtn.onclick = (e) => {
                    e.stopPropagation();
                    promptDeleteCategory(cat);
                };
                btn.appendChild(delBtn);

                // Add HTML5 Drag/Drop DOM Listeners
                btn.addEventListener('dragstart', handleDragStart);
                btn.addEventListener('dragover', handleDragOver);
                btn.addEventListener('drop', handleDrop);
                btn.addEventListener('dragenter', handleDragEnter);
                btn.addEventListener('dragleave', handleDragLeave);
            }

            btn.onclick = (e) => {
                if (e.type === 'drag') return; // Ignore drops clicking organically

                // Clear any product view if returning to categories
                if (shopSection && shopSection.style.display === 'none') {
                    productViewSection.style.display = 'none';
                    shopSection.style.display = 'block';
                }

                categoryTabsContainer.querySelectorAll('.tab-btn').forEach(b => b.classList.remove('active'));
                btn.classList.add('active');
                currentCategorySlug = cat.slug;
                renderProducts(currentCategorySlug);
                updateUrlState(currentCategorySlug);
            };
            categoryTabsContainer.appendChild(btn);
        });
    }

    if (isAdmin) {
        const addBtn = document.createElement('button');
        addBtn.className = 'tab-btn add-category-btn';
        addBtn.innerHTML = '+ Add Category';
        addBtn.onclick = () => {
            categoryForm.reset();
            categoryModal.style.display = 'flex';
        };
        categoryTabsContainer.appendChild(addBtn);
    }
}

let currentPage = 1;
const itemsPerPage = 8;
const prevPageBtn = document.getElementById('prev-page-btn');
const nextPageBtn = document.getElementById('next-page-btn');
const pageIndicator = document.getElementById('page-indicator');
const errorViewSection = document.getElementById('error-view');
const errorMessageText = document.getElementById('error-message');

window.showErrorPage = function (message) {
    if (shopSection) shopSection.style.display = 'none';
    if (productViewSection) productViewSection.style.display = 'none';
    if (errorViewSection) {
        errorViewSection.style.display = 'flex';
        if (message) {
            errorMessageText.textContent = message;
        } else {
            errorMessageText.textContent = "The page or product you are looking for doesn't exist or has been moved.";
        }
    }
};

function renderProducts(categorySlug, page = 1) {
    if (!productGrid) return;
    productGrid.innerHTML = '';
    if (errorViewSection) errorViewSection.style.display = 'none';

    currentPage = page;

    if (isAdmin) {
        const addCard = document.createElement('div');
        addCard.className = 'product-card add-product-card';
        addCard.innerHTML = `
            <div style="display: flex; flex-direction: column; align-items: center; justify-content: center; height: 100%; min-height: 250px; cursor: pointer; color: var(--primary);" onclick="window.openEditModal()">
                <span class="material-icons-round" style="font-size: 48px; margin-bottom: 1rem;">add_circle</span>
                <h3 style="margin: 0; font-family: var(--font-heading); font-size: 1.25rem;">Add Product</h3>
                <p style="font-size: 0.9rem; color: var(--text-muted); text-align: center; margin-top: 0.5rem; font-family: var(--font-body);">to ${getCategoryNameFromSlug(categorySlug)}</p>
            </div>
        `;
        productGrid.appendChild(addCard);
    }

    const filteredProducts = inventory.filter(p => p.categorySlug === categorySlug);

    if (filteredProducts.length === 0 && !isAdmin) {
        productGrid.innerHTML = '<div style="grid-column: 1/-1; text-align: center; color: var(--text-muted); padding: 3rem;">No products found in this category.</div>';
        if (prevPageBtn) prevPageBtn.disabled = true;
        if (nextPageBtn) nextPageBtn.disabled = true;
        if (pageIndicator) pageIndicator.textContent = 'Page 1 of 1';
        return;
    }

    // Pagination Logic
    const totalPages = Math.ceil(filteredProducts.length / itemsPerPage) || 1;

    // Hard error on out-of-bounds pagination navigation
    if (currentPage > totalPages || currentPage < 1) {
        window.showErrorPage(`Page ${currentPage} does not exist in the ${getCategoryNameFromSlug(categorySlug)} category. There are only ${totalPages} pages.`);
        return;
    }

    const startIndex = (currentPage - 1) * itemsPerPage;
    const endIndex = startIndex + itemsPerPage;
    const paginatedProducts = filteredProducts.slice(startIndex, endIndex);

    // Update Pagination UI
    if (prevPageBtn) {
        prevPageBtn.disabled = currentPage === 1;
        prevPageBtn.onclick = () => {
            const tempPage = currentPage;
            if (tempPage > 1) {
                renderProducts(categorySlug, tempPage - 1);
                updateUrlState(categorySlug, tempPage - 1);
                window.scrollTo({ top: shopSection ? shopSection.offsetTop - 100 : 0, behavior: 'smooth' });
            }
        };
    }
    if (nextPageBtn) {
        nextPageBtn.disabled = currentPage === totalPages;
        nextPageBtn.onclick = () => {
            const tempPage = currentPage;
            if (tempPage < totalPages) {
                renderProducts(categorySlug, tempPage + 1);
                updateUrlState(categorySlug, tempPage + 1);
                window.scrollTo({ top: shopSection ? shopSection.offsetTop - 100 : 0, behavior: 'smooth' });
            }
        };
    }
    if (pageIndicator) {
        pageIndicator.textContent = `Page ${currentPage} of ${totalPages}`;
    }

    paginatedProducts.forEach(product => {
        const hasOffer = product.offerPrice !== null && product.offerPrice > 0;
        const priceDisplay = hasOffer ?
            `<span class="product-price">৳${product.offerPrice.toFixed(2)}</span><span class="price-strike">৳${product.price.toFixed(2)}</span>` :
            `<span class="product-price">৳${product.price.toFixed(2)}</span>`;

        let badges = '';
        if (product.isSale) badges += `<div class="product-badge badge-sale">SALE</div>`;
        else if (product.isNew) badges += `<div class="product-badge badge-new">NEW</div>`;

        let stockBadge = '';
        let cartButtonDisabled = '';
        let adminStockView = '';

        if (isAdmin) {
            adminStockView = `<div style="font-size: 0.8rem; color: var(--primary); font-weight: bold; margin-bottom: 0.25rem;">(Stock: ${product.stock !== undefined ? product.stock : '∞'})</div>`;
        }

        if (product.stock === 0) {
            stockBadge = `<div style="position: absolute; top: 50%; left: 50%; transform: translate(-50%, -50%); background: rgba(0,0,0,0.7); color: white; padding: 0.5rem 1rem; border-radius: var(--radius-sm); font-weight: bold; z-index: 10; letter-spacing: 1px; white-space: nowrap;">OUT OF STOCK</div>`;
            cartButtonDisabled = 'disabled style="opacity: 0.5; cursor: not-allowed;"';
        } else if (product.stock > 0 && product.stock < 3) {
            stockBadge = `<div style="position: absolute; bottom: 8px; left: 8px; background: #ff9800; color: white; padding: 0.25rem 0.5rem; border-radius: 4px; font-size: 0.75rem; font-weight: bold; z-index: 10;">Low on stock</div>`;
        }

        let adminActions = '';
        if (isAdmin) {
            adminActions = `
                <button class="edit-product-btn" onclick="window.openEditModal('${product.id}')" title="Edit Product">
                    <span class="material-icons-round">edit</span>
                </button>
                <button class="delete-product-btn" onclick="window.deleteProduct('${product.categoryId}', '${product.id}')" title="Delete Product">
                    <span class="material-icons-round">delete</span>
                </button>
            `;
        }

        const card = document.createElement('div');
        card.className = 'product-card';

        // Handle undefined image smoothly
        const imgSrc = getAbsoluteImageUrl(product.image);
        const imgDisplay = product.image ? `<img src="${imgSrc}" alt="${product.name}" class="product-img" loading="lazy">` : `<div class="product-img" style="display:flex; align-items:center; justify-content:center; background:#eee; color:#aaa; height: 200px; width: 100%;">No Image</div>`;

        card.innerHTML = `
            ${adminActions}
            <div onclick="window.renderProductPage('${product.slug}')" style="cursor: pointer; display: flex; flex-direction: column; flex-grow: 1;">
                <div class="product-img-wrap" style="position: relative;">
                    ${badges}
                    ${stockBadge}
                    ${imgDisplay}
                </div>
                <div class="product-info">
                    ${adminStockView}
                    <div class="product-category">${product.categoryId}</div>
                    <h3 class="product-title">${product.name || 'Unnamed Product'}</h3>
                </div>
            </div>
            <div class="product-footer" style="display: flex; justify-content: space-between; align-items: center; margin-top: auto;">
                <div class="product-price-wrap">
                    ${priceDisplay}
                </div>
                <button class="add-to-cart" onclick="window.addCartItem('${product.id}')" aria-label="Add to cart" ${cartButtonDisabled}>
                    <span class="material-icons-round">add_shopping_cart</span>
                </button>
            </div>
        `;
        productGrid.appendChild(card);
    });
}

// --- User Authentication & Profile Logic ---
function updateAuthUI() {
    // If admin is active, strictly hide the login button no matter what
    if (isAdmin) {
        if (authLoginBtn) authLoginBtn.style.display = 'none';
        if (userProfileBadge) userProfileBadge.style.display = 'none';
        if (cartToggleBtn) cartToggleBtn.style.display = 'none';
        if (adminNavbarLogoutBtn) adminNavbarLogoutBtn.style.display = 'block';
        return;
    }

    // Reset standard generic views if not admin
    if (cartToggleBtn) cartToggleBtn.style.display = 'flex';
    if (adminNavbarLogoutBtn) adminNavbarLogoutBtn.style.display = 'none';

    if (currentUser) {
        if (authLoginBtn) authLoginBtn.style.display = 'none';
        if (userProfileBadge) {
            userProfileBadge.style.display = 'flex';
            userProfileName.textContent = currentUser.name || currentUser.id;
        }
    } else {
        if (authLoginBtn) authLoginBtn.style.display = 'block';
        if (userProfileBadge) userProfileBadge.style.display = 'none';
        // Enforce path fallback if session expires or logs out, preserving current view
        if (routingInitialized && categories.length > 0) {
            if (window.currentViewedProduct && shopSection && shopSection.style.display === 'none') {
                updateUrlState(currentCategorySlug, currentPage, window.currentViewedProduct.slug);
            } else {
                updateUrlState(currentCategorySlug, currentPage);
            }
        }
    }
}

function openAuthModal(view = 'login') {
    if (loginForm) loginForm.reset();
    if (registerForm) registerForm.reset();
    if (profileForm) profileForm.reset();

    // Re-initialize location dropdowns just in case they were empty at boot 
    // before the Firebase locations document finished syncing.
    if (Object.keys(steadfastLocations).length > 0) {
        initLocationDropdowns();
    }

    if (currentUser) {
        if (authModalTitle) authModalTitle.textContent = "Your Profile";
        if (loginView) loginView.style.display = 'none';
        if (registerView) registerView.style.display = 'none';
        if (profileView) profileView.style.display = 'block';

        // Profile Tabs Engine
        const tabDetails = document.getElementById('tab-profile-details');
        const tabOrders = document.getElementById('tab-profile-orders');
        const contentDetails = document.getElementById('profile-details-content');
        const contentOrders = document.getElementById('profile-orders-content');

        if (tabDetails && tabOrders) {
            tabDetails.onclick = () => {
                tabDetails.style.borderBottomColor = 'var(--primary)';
                tabDetails.style.color = 'var(--primary)';
                tabOrders.style.borderBottomColor = 'transparent';
                tabOrders.style.color = 'var(--text-muted)';
                contentDetails.style.display = 'block';
                contentOrders.style.display = 'none';
                updateUrlState('Details'); // Optional pathing
            };

            tabOrders.onclick = () => {
                tabOrders.style.borderBottomColor = 'var(--primary)';
                tabOrders.style.color = 'var(--primary)';
                tabDetails.style.borderBottomColor = 'transparent';
                tabDetails.style.color = 'var(--text-muted)';
                contentDetails.style.display = 'none';
                contentOrders.style.display = 'block';
                loadProfileOrders();
                updateUrlState('Orders'); // Required pathing -> /{UserID}/Orders
            };

            // Force Details visible by default
            tabDetails.click();
        }

        if (profileUsernameInput) profileUsernameInput.value = currentUser.name || '';
        if (profileUseridInput) profileUseridInput.value = currentUser.id;
        if (profileMobileInput) profileMobileInput.value = currentUser.mobile || '';
        if (profileAddressInput) profileAddressInput.value = currentUser.address || '';

        if (profileDistrictInput && currentUser.district) {
            let mappedDistrict = currentUser.district;
            if (mappedDistrict === "Dhaka City" || mappedDistrict === "Dhaka Sub-Urban") {
                mappedDistrict = "Dhaka";
            }
            profileDistrictInput.value = mappedDistrict;

            profileDistrictInput.dispatchEvent(new Event('change'));

            if (profileThanaInput && currentUser.thana) {
                profileThanaInput.value = currentUser.thana;
            }
        }

        loadProfileOrders();
    } else {
        if (view === 'login') {
            if (authModalTitle) authModalTitle.textContent = "Login";
            if (loginView) loginView.style.display = 'block';
            if (registerView) registerView.style.display = 'none';
            if (profileView) profileView.style.display = 'none';
        } else {
            if (authModalTitle) authModalTitle.textContent = "Register";
            if (loginView) loginView.style.display = 'none';
            if (registerView) registerView.style.display = 'block';
            if (profileView) profileView.style.display = 'none';
        }
        updateUrlState(view); // Instantly update URL to /login or /register
    }
    if (authModal) authModal.style.display = 'flex';
}

const closeAuthModal = () => {
    if (authModal) authModal.style.display = 'none';
    if (currentCategorySlug) updateUrlState(currentCategorySlug); // Revert to active category
};

if (authLoginBtn) authLoginBtn.addEventListener('click', () => openAuthModal('login'));
if (userProfileBadge) userProfileBadge.addEventListener('click', () => openAuthModal());
if (closeAuthModalBtn) closeAuthModalBtn.addEventListener('click', closeAuthModal);

// --- Steadfast Locations Dropdowns ---
function initLocationDropdowns() {
    const districts = Object.keys(steadfastLocations).filter(d => d !== "Dhaka City" && d !== "Dhaka Sub-Urban");
    districts.push("Dhaka");
    districts.sort();

    const populateDistrict = (selectElement) => {
        if (!selectElement) return;
        selectElement.innerHTML = '<option value="" disabled selected>Select District</option>';
        districts.forEach(d => {
            const opt = document.createElement('option');
            opt.value = d;
            opt.textContent = d;
            selectElement.appendChild(opt);
        });
    };

    populateDistrict(registerDistrictInput);
    populateDistrict(profileDistrictInput);

    const handleDistrictChange = (thanaSelect) => (e) => {
        const selected = e.target.value;
        if (!thanaSelect) return;
        thanaSelect.innerHTML = '<option value="" disabled selected>Select Thana</option>';
        thanaSelect.disabled = false;
        thanaSelect.style.background = 'var(--bg-card)';
        thanaSelect.style.cursor = 'pointer';

        let thanas = [];
        if (selected === "Dhaka") {
            thanas = [...steadfastLocations["Dhaka City"], ...steadfastLocations["Dhaka Sub-Urban"]];
        } else if (steadfastLocations[selected]) {
            thanas = steadfastLocations[selected];
        }

        thanas.sort().forEach(t => {
            const opt = document.createElement('option');
            opt.value = t;
            opt.textContent = t;
            thanaSelect.appendChild(opt);
        });
    };

    if (registerDistrictInput && registerThanaInput) {
        registerDistrictInput.addEventListener('change', handleDistrictChange(registerThanaInput));
    }
    if (profileDistrictInput && profileThanaInput) {
        profileDistrictInput.addEventListener('change', handleDistrictChange(profileThanaInput));
    }
}

function getTrueDistrict(districtValue, thanaValue) {
    if (districtValue === "Dhaka") {
        if (steadfastLocations["Dhaka City"]?.includes(thanaValue)) return "Dhaka City";
        if (steadfastLocations["Dhaka Sub-Urban"]?.includes(thanaValue)) return "Dhaka Sub-Urban";
    }
    return districtValue;
}

initLocationDropdowns();

// Password Visibility Toggles
document.querySelectorAll('.toggle-password').forEach(icon => {
    icon.addEventListener('click', function () {
        const input = this.previousElementSibling;
        if (input.type === 'password') {
            input.type = 'text';
            this.textContent = 'visibility_off';
        } else {
            input.type = 'password';
            this.textContent = 'visibility';
        }
    });
});

if (showRegisterBtn) showRegisterBtn.addEventListener('click', (e) => { e.preventDefault(); openAuthModal('register'); });
if (showLoginBtn) showLoginBtn.addEventListener('click', (e) => { e.preventDefault(); openAuthModal('login'); });

if (authLogoutBtn) {
    authLogoutBtn.addEventListener('click', () => {
        currentUser = null;
        localStorage.removeItem('tc_user');
        sessionStorage.removeItem('tc_user');

        // Wipe local cart on explicit sign out
        cart = [];
        localStorage.setItem('tc_cart', '[]');
        saveCart();

        updateAuthUI();
        closeAuthModal();

        // Bounce to root category visually
        if (categories.length > 0) {
            currentCategorySlug = categories[0].slug;
            updateUrlState(currentCategorySlug);
            renderCategoryTabs();
            loadInventoryItems();
        }
    });
}

// UserID Auto-generation logic (Debounced)
let debounceTimer;
if (registerUsernameInput) {
    registerUsernameInput.addEventListener('input', () => {
        clearTimeout(debounceTimer);
        const username = registerUsernameInput.value.trim();
        const baseId = username.toLowerCase().replace(/[^a-z0-9]/g, '');

        if (!baseId) {
            registerUseridInput.value = '';
            registerSubmitBtn.disabled = false;
            return;
        }

        if (baseId.includes('admin') || username.toLowerCase().includes('admin')) {
            registerUseridInput.value = "Username cannot contain 'admin'";
            registerSubmitBtn.disabled = true;
            return;
        }

        registerUseridInput.value = "Checking availability...";
        registerSubmitBtn.disabled = true;

        debounceTimer = setTimeout(async () => {
            try {
                let candidate = baseId;
                let i = 0;
                while (true) {
                    const docSnap = await getDoc(doc(db, 'Users', candidate));
                    if (!docSnap.exists()) {
                        registerUseridInput.value = candidate;
                        registerSubmitBtn.disabled = false;
                        break;
                    }
                    i++;
                    candidate = baseId + i;
                }
            } catch (e) {
                console.error("Error auto-generating ID:", e);
                registerUseridInput.value = "Error checking ID";
                registerSubmitBtn.disabled = false;
            }
        }, 600);
    });
}

// Login Submit
if (loginForm) {
    loginForm.addEventListener('submit', async (e) => {
        e.preventDefault();
        const identifier = loginIdentifierInput.value.trim();
        const password = loginPasswordInput.value;
        const remember = loginRememberInput.checked;

        if (!identifier || !password) return;

        loginSubmitBtn.disabled = true;
        loginSubmitBtn.textContent = "Checking...";

        try {
            // First treat identifier as Document ID (UserID)
            let userSnap = await getDoc(doc(db, 'Users', identifier));

            // If it doesn't exist, search the 'username' field strictly
            if (!userSnap.exists()) {
                const qUser = query(collection(db, 'Users'), where('username', '==', identifier));
                const qsUser = await getDocs(qUser);
                if (!qsUser.empty) {
                    userSnap = qsUser.docs[0];
                } else {
                    // Finally check the 'mobile' field
                    const qMobile = query(collection(db, 'Users'), where('mobile', '==', identifier));
                    const qsMobile = await getDocs(qMobile);
                    if (!qsMobile.empty) {
                        userSnap = qsMobile.docs[0];
                    }
                }
            }

            if (userSnap.exists()) {
                const data = userSnap.data();
                if (data.password === password) {
                    currentUser = {
                        id: userSnap.id,
                        name: data.username || '',
                        mobile: data.mobile || '',
                        address: data.address || ''
                    };

                    if (remember) {
                        localStorage.setItem('tc_user', JSON.stringify(currentUser));
                    } else {
                        sessionStorage.setItem('tc_user', JSON.stringify(currentUser));
                    }

                    await handleFirebaseCartSync(currentUser.id);

                    updateAuthUI();
                    closeAuthModal();

                    if (currentCategorySlug) {
                        updateUrlState(currentCategorySlug);
                    }
                } else {
                    alert("Incorrect password.");
                }
            } else {
                alert("Account not found. Please register.");
            }
        } catch (err) {
            console.error("Login Error:", err);
            alert("Error communicating with the database.");
        }

        loginSubmitBtn.disabled = false;
        loginSubmitBtn.textContent = "Login";
    });
}

// Register Submit
if (registerForm) {
    registerForm.addEventListener('submit', async (e) => {
        e.preventDefault();
        const username = registerUsernameInput.value.trim();
        const userid = registerUseridInput.value.trim();
        const mobile = registerMobileInput.value.trim();
        const password = registerPasswordInput.value;
        const address = registerAddressInput.value.trim();
        const rawDistrict = registerDistrictInput.value;
        const rawThana = registerThanaInput.value;
        const remember = registerRememberInput.checked;

        if (!username || !userid || !password || !mobile || !rawDistrict || !rawThana || userid.includes("Checking") || userid.includes("contains")) {
            alert("Please fill all fields properly (including District and Thana) and wait for ID validation.");
            return;
        }

        if (username.toLowerCase().includes('admin') || userid.toLowerCase().includes('admin')) {
            alert("Security Policy: Usernames and IDs cannot contain the word 'admin'.");
            registerSubmitBtn.disabled = false;
            return;
        }

        registerSubmitBtn.disabled = true;
        registerSubmitBtn.textContent = "Registering...";

        try {
            const userRef = doc(db, 'Users', userid);
            const userSnap = await getDoc(userRef);

            if (userSnap.exists()) {
                alert("Conflict: The requested User ID '" + userid + "' is already heavily tracked! Please alter it manually.");
            } else {
                const finalDistrict = getTrueDistrict(rawDistrict, rawThana);

                await setDoc(userRef, {
                    username: username,
                    mobile: mobile,
                    password: password,
                    address: address,
                    district: finalDistrict,
                    thana: rawThana,
                    createdAt: Date.now()
                });

                currentUser = { id: userid, name: username, mobile: mobile, address: address, district: finalDistrict, thana: rawThana };
                if (remember) {
                    localStorage.setItem('tc_user', JSON.stringify(currentUser));
                } else {
                    sessionStorage.setItem('tc_user', JSON.stringify(currentUser));
                }

                // Flush empty registered cart locally just in case
                cart = [];
                saveCart();

                updateAuthUI();
                closeAuthModal();

                if (currentCategorySlug) {
                    updateUrlState(currentCategorySlug);
                }
            }
        } catch (err) {
            console.error("Register Error:", err);
            alert("Error communicating with the database.");
        }

        registerSubmitBtn.disabled = false;
        registerSubmitBtn.textContent = "Register";
    });
}

// Profile Update Submit
if (profileForm) {
    profileForm.addEventListener('submit', async (e) => {
        e.preventDefault();
        const newAddress = profileAddressInput.value.trim();
        const newMobile = profileMobileInput.value.trim();
        const rawDistrict = profileDistrictInput.value;
        const rawThana = profileThanaInput.value;

        if (!currentUser) return;
        if (!rawDistrict || !rawThana) {
            alert("Please accurately select both a District and a Thana before saving.");
            return;
        }

        profileUpdateBtn.disabled = true;
        profileUpdateBtn.textContent = "Updating...";

        try {
            const finalDistrict = getTrueDistrict(rawDistrict, rawThana);
            await updateDoc(doc(db, 'Users', currentUser.id), {
                address: newAddress,
                mobile: newMobile,
                district: finalDistrict,
                thana: rawThana
            });
            currentUser.address = newAddress;
            currentUser.mobile = newMobile;
            currentUser.district = finalDistrict;
            currentUser.thana = rawThana;

            if (localStorage.getItem('tc_user')) {
                localStorage.setItem('tc_user', JSON.stringify(currentUser));
            } else {
                sessionStorage.setItem('tc_user', JSON.stringify(currentUser));
            }
            alert("Profile updated successfully!");
            closeAuthModal();
        } catch (err) {
            console.error("Profile Update Error:", err);
            alert("Failed to update profile.");
        }

        profileUpdateBtn.disabled = false;
        profileUpdateBtn.textContent = "Update Profile";
    });
}

// --- Admin Authentication & Triggers ---
function toggleAdminMode(state) {
    isAdmin = state;
    sessionStorage.setItem('tc_admin', state);

    if (isAdmin) {
        // Log out normal user if they were mistakenly logged in while activating Admin
        if (currentUser) {
            currentUser = null;
            localStorage.removeItem('tc_user');
            sessionStorage.removeItem('tc_user');
            updateAuthUI();
        }
        if (adminToolsBanner) adminToolsBanner.style.display = 'flex';
        if (adminHeaderEditContainer) adminHeaderEditContainer.style.display = 'block';
        if (routingInitialized) updateUrlState('admin');
    } else {
        if (adminToolsBanner) adminToolsBanner.style.display = 'none';
        if (adminHeaderEditContainer) adminHeaderEditContainer.style.display = 'none';
        if (routingInitialized && categories && categories.length > 0) {
            currentCategorySlug = categories[0].slug;
            updateUrlState(currentCategorySlug);
        }
    }

    renderCategoryTabs();
    renderProducts(currentCategorySlug);
    updateAuthUI();
}

// Secret Admin Login Trigger (Hold 'Toy & Craft' logic for 2 seconds)
let holdTimer = null;
if (siteTitle) {
    const startHold = (e) => {
        if (e.type === 'mousedown' && e.button !== 0) return;

        holdTimer = setTimeout(() => {
            if (!isAdmin) {
                if (routingInitialized) updateUrlState('authenticate-admin');
                promptPassword("Enter Admin Password", (pass) => {
                    if (pass === atob("MDEyNw==")) {
                        toggleAdminMode(true);
                    } else {
                        alert("Incorrect password.");
                    }
                });
            } else {
                alert("Admin Mode is already active.");
            }
        }, 2000);
    };

    const cancelHold = () => { if (holdTimer) clearTimeout(holdTimer); };

    siteTitle.addEventListener('mousedown', startHold);
    siteTitle.addEventListener('touchstart', startHold, { passive: true });
    siteTitle.addEventListener('mouseup', cancelHold);
    siteTitle.addEventListener('mouseleave', cancelHold);
    siteTitle.addEventListener('touchend', cancelHold);
    siteTitle.addEventListener('touchcancel', cancelHold);
    siteTitle.addEventListener('click', (e) => {
        // Double as a Home Button when clicked normally
        if (routingInitialized && categories && categories.length > 0) {
            // Pick first generic slug to act as physical Home
            currentCategorySlug = categories[0].slug;
            updateUrlState(currentCategorySlug);
            renderCategoryTabs();
            renderProducts(currentCategorySlug);
            closeCart();
        }
    });
}

// Add duplicate home-button functionality directly to the physical image logo too
const siteLogoImg = document.querySelector('.site-logo-img');
if (siteLogoImg) {
    siteLogoImg.style.cursor = 'pointer';
    siteLogoImg.addEventListener('click', (e) => {
        if (routingInitialized && categories && categories.length > 0) {
            currentCategorySlug = categories[0].slug;
            updateUrlState(currentCategorySlug);
            renderCategoryTabs();
            renderProducts(currentCategorySlug);
            closeCart();
        }
    });
}

if (adminNavbarLogoutBtn) {
    adminNavbarLogoutBtn.addEventListener('click', () => toggleAdminMode(false));
}

// --- Custom Password Modal ---
let currentPasswordCallback = null;
function promptPassword(title, callback) {
    if (passwordModalTitle) passwordModalTitle.textContent = title;
    if (passwordInput) passwordInput.value = '';
    currentPasswordCallback = callback;
    if (passwordModal) passwordModal.style.display = 'flex';
    setTimeout(() => { if (passwordInput) passwordInput.focus(); }, 100);
}
function closePasswordModal() {
    if (passwordModal) passwordModal.style.display = 'none';
    currentPasswordCallback = null;

    // Bounce unauthenticated probers back to home if they cancel out of the Admin auth challenge route
    if (window.location.pathname.includes('authenticate-admin') && !isAdmin) {
        if (routingInitialized && categories && categories.length > 0) {
            currentCategorySlug = categories[0].slug;
            updateUrlState(currentCategorySlug);
            renderCategoryTabs();
            renderProducts(currentCategorySlug);
        }
    }
}
if (passwordCancelBtn) passwordCancelBtn.addEventListener('click', closePasswordModal);
if (passwordInput) {
    passwordInput.addEventListener('keydown', (e) => {
        if (e.key === 'Enter') {
            e.preventDefault();
            if (passwordSubmitBtn) passwordSubmitBtn.click();
        }
    });
}
if (passwordSubmitBtn) {
    passwordSubmitBtn.addEventListener('click', () => {
        if (currentPasswordCallback) currentPasswordCallback(passwordInput.value);
        closePasswordModal();
    });
}

// --- Admin Section Header Editing ---
if (adminEditHeaderBtn) {
    adminEditHeaderBtn.addEventListener('click', () => {
        if (adminHeaderTitleInput) adminHeaderTitleInput.value = homeTitle ? homeTitle.textContent : 'Toy & Craft';
        if (adminHeaderSubtitleInput) adminHeaderSubtitleInput.value = homeSubtitle ? homeSubtitle.textContent : 'Premium Miniature Collections';
        if (headerModal) headerModal.style.display = 'flex';
    });
}

const closeHeaderModalFn = () => { if (headerModal) headerModal.style.display = 'none'; };
if (closeHeaderModalBtn) closeHeaderModalBtn.addEventListener('click', closeHeaderModalFn);
if (headerCancelBtn) headerCancelBtn.addEventListener('click', closeHeaderModalFn);

if (adminHeaderForm) {
    adminHeaderForm.addEventListener('submit', (e) => {
        e.preventDefault();
        const newTitle = adminHeaderTitleInput.value.trim();
        const newSubtitle = adminHeaderSubtitleInput.value.trim();

        if (newTitle && newSubtitle) {
            // Write directly to the persistent SiteMetadata singleton
            setDoc(doc(db, 'Settings', 'SiteMetadata'), {
                title: newTitle,
                subtitle: newSubtitle,
                updatedAt: Date.now()
            }, { merge: true }).then(() => {
                closeHeaderModalFn();
            }).catch(err => {
                console.error("Failed to update site metadata:", err);
                alert("Failed to save changes to the database.");
            });
        }
    });
}

// --- Category Creation & Deletion (Firebase) ---
const closeCategoryModalFn = () => { if (categoryModal) categoryModal.style.display = 'none'; };
if (closeCategoryModalBtn) closeCategoryModalBtn.addEventListener('click', closeCategoryModalFn);
if (categoryCancelBtn) categoryCancelBtn.addEventListener('click', closeCategoryModalFn);

if (categoryForm) {
    categoryForm.addEventListener('submit', async (e) => {
        e.preventDefault();
        const newCatName = newCategoryNameInput.value.trim();
        if (!newCatName) return;

        try {
            // Give new category the highest order index dynamically to append to front of line natively
            let newOrder = 0;
            if (categories.length > 0) {
                newOrder = Math.max(...categories.map(c => c.order || 0)) + 1;
            }

            // Write parent document if it doesn't exist
            await setDoc(doc(db, 'Products', newCatName), { createdAt: Date.now(), order: newOrder }, { merge: true });

            // Switch tabs aggressively to it locally
            currentCategorySlug = generateSlug(newCatName);
            closeCategoryModalFn();
        } catch (err) {
            console.error("Error creating category:", err);
            alert("Failed to create category on the database.");
        }
    });
}

function promptDeleteCategory(cat) {
    promptPassword(`Delete "${cat.id}"? Enter password:`, async (pass) => {
        if (pass === atob("MDEyNw==")) {
            try {
                // Delete all documents in the Items subcollection first to ensure clean state
                const itemsSnap = await getDocs(collection(db, 'Products', cat.id, 'Items'));
                const batchPromises = itemsSnap.docs.map(d => deleteDoc(d.ref));
                await Promise.all(batchPromises);

                // Then delete the parent document
                await deleteDoc(doc(db, 'Products', cat.id));
                alert(`Category "${cat.id}" deleted successfully.`);
            } catch (err) {
                console.error("Error deleting category:", err);
                alert("Failed to delete category.");
            }
        } else {
            alert("Incorrect deletion password. Category not deleted.");
        }
    });
}

// --- Product Creation & Editing (Firebase) ---
window.openEditModal = function (productId = null) {
    if (adminProductCategory) adminProductCategory.innerHTML = '';
    categories.forEach(cat => {
        const opt = document.createElement('option');
        opt.value = cat.id; // DB ID (e.g. "Mini Bricks")
        opt.textContent = cat.id;
        if (adminProductCategory) adminProductCategory.appendChild(opt);
    });

    if (productId) {
        const product = inventory.find(p => p.id === productId);
        if (!product) return;

        if (adminModalTitle) adminModalTitle.textContent = "Edit Product";
        if (adminProductId) adminProductId.value = product.id;
        if (adminProductName) adminProductName.value = product.name;
        if (adminProductCategory) adminProductCategory.value = product.categoryId;
        if (adminProductPrice) adminProductPrice.value = product.price;
        if (adminProductOffer) adminProductOffer.value = product.offerPrice || '';
        const adminProductImageEl = document.getElementById('admin-product-image');
        const adminProductDesc = document.getElementById('admin-product-description');
        if (adminProductImageEl) adminProductImageEl.value = (product.images && product.images.length > 0) ? product.images.join(', ') : (product.image || '');
        if (adminProductDesc) adminProductDesc.value = product.description || '';
        const adminProductStock = document.getElementById('admin-product-stock');
        if (adminProductStock && product.stock !== undefined) adminProductStock.value = product.stock;
        if (adminProductNew) adminProductNew.checked = product.isNew;
        if (adminProductSale) adminProductSale.checked = product.isSale;

        // Save the original category so we know if it was moved
        if (adminProductId) adminProductId.setAttribute('data-original-cat', product.categoryId);
    } else {
        if (adminModalTitle) adminModalTitle.textContent = "Add New Product";
        if (adminProductForm) adminProductForm.reset();
        if (adminProductId) adminProductId.value = '';
        if (adminProductId) adminProductId.removeAttribute('data-original-cat');

        // Pre-select the current category
        const catName = getCategoryNameFromSlug(currentCategorySlug);
        if (catName && adminProductCategory) adminProductCategory.value = catName;
    }

    if (adminModal) adminModal.style.display = 'flex';
};

const closeAdminModalFn = () => { if (adminModal) adminModal.style.display = 'none'; };
if (closeAdminModal) closeAdminModal.addEventListener('click', closeAdminModalFn);
if (adminCancelBtn) adminCancelBtn.addEventListener('click', closeAdminModalFn);

if (adminProductForm) {
    adminProductForm.addEventListener('submit', async (e) => {
        e.preventDefault();

        const offerVal = parseFloat(adminProductOffer.value);
        const adminProductImageEl = document.getElementById('admin-product-image');
        const adminProductDesc = document.getElementById('admin-product-description');
        const imagesRaw = adminProductImageEl ? adminProductImageEl.value.split(',').map(s => s.trim()).filter(Boolean) : [];
        const mainImage = imagesRaw.length > 0 ? imagesRaw[0] : '';
        const adminProductStock = document.getElementById('admin-product-stock');

        const productData = {
            name: adminProductName.value.trim(),
            description: adminProductDesc ? adminProductDesc.value.trim() : '',
            images: imagesRaw,
            price: parseFloat(adminProductPrice.value),
            offerPrice: isNaN(offerVal) ? null : offerVal,
            image: mainImage,
            isNew: adminProductNew.checked,
            isSale: adminProductSale.checked,
            stock: adminProductStock ? parseInt(adminProductStock.value) : 10,
            updatedAt: Date.now()
        };

        const targetCatId = adminProductCategory.value;
        const productId = adminProductId.value;
        const targetRef = productId ?
            doc(db, 'Products', targetCatId, 'Items', productId) :
            doc(collection(db, 'Products', targetCatId, 'Items')); // Auto-gen ID for new

        try {
            // Handle category moves for edits
            const originalCatId = adminProductId.getAttribute('data-original-cat');
            if (productId && originalCatId && originalCatId !== targetCatId) {
                // Delete from old category
                await deleteDoc(doc(db, 'Products', originalCatId, 'Items', productId));
            }

            // Save to new/existing path
            await setDoc(targetRef, productData, { merge: true });

            // Re-sync local UI to view the new product's category
            currentCategorySlug = generateSlug(targetCatId);
            closeAdminModalFn();

        } catch (err) {
            console.error("Error saving product:", err);
            alert("Database Error: Failed to save product.");
        }
    });
}

window.deleteProduct = async function (categoryName, id) {
    if (confirm("Are you sure you want to delete this product?")) {
        try {
            await deleteDoc(doc(db, 'Products', categoryName, 'Items', id));

            // Remove from cart locally
            cart = cart.filter(item => item.id !== id);
            saveCart();

        } catch (err) {
            console.error("Error deleting product:", err);
            alert("Database Error: Could not delete product.");
        }
    }
};

// --- Cart System (Local Storage Only) ---
function saveCart() {
    localStorage.setItem('tc_cart', JSON.stringify(cart));
    updateCartUI();

    // Ensure total badge mirrors on any generic resave
    const totalItems = cart.reduce((sum, item) => sum + item.qty, 0);
    if (cartBadge) {
        cartBadge.textContent = totalItems;
        cartBadge.style.display = totalItems > 0 ? 'flex' : 'none';
    }
}

async function handleFirebaseCartSync(uid) {
    // Attempt to hydrate local cart from active Firebase saved cart
    try {
        const cartSnap = await getDocs(collection(db, 'Users', uid, 'Cart'));
        if (!cartSnap.empty) {
            cart = cartSnap.docs.map(doc => doc.data());
            saveCart(); // Flush the merged result down locally
            console.log("Hydrated Cart from Cloud:", cart.length, "items.");
        } else {
            // User cloud cart is empty, wipe local guest cart to reflect reality
            cart = [];
            saveCart();
            console.log("Hydrated Cart from Cloud: 0 items.");
        }
    } catch (e) {
        console.warn("Silent cart hydration failure", e);
    }
}

window.addCartItem = function (productId) {
    const product = inventory.find(p => p.id === productId);
    if (!product) return;

    // Hard block if literally zero stock somehow bypassed the HTML disabled state
    if (product.stock === 0) {
        alert("This item is currently out of stock.");
        return;
    }

    const existingItem = cart.find(item => item.id === productId);
    let targetPayload = null;

    if (existingItem) {
        if (existingItem.qty >= product.stock) {
            alert(`Sorry, only ${product.stock} units are available in stock.`);
            return;
        }
        existingItem.qty += 1;
        // Keep price synced with active inventory state
        existingItem.currentPrice = product.offerPrice || product.price;
        targetPayload = existingItem;
    } else {
        const newItem = {
            ...product,
            qty: 1,
            currentPrice: product.offerPrice || product.price
        };
        cart.push(newItem);
        targetPayload = newItem;
    }

    saveCart();
    openCart();

    if (currentUser && targetPayload) {
        setDoc(doc(db, 'Users', currentUser.id, 'Cart', targetPayload.id), targetPayload).catch(e => console.error("Failsync Cart Add", e));
    }
};

window.updateQty = function (productId, delta) {
    const item = cart.find(item => item.id === productId);
    const product = inventory.find(p => p.id === productId);
    if (item) {
        // Prevent exceeding stock on + operations
        if (delta > 0 && product && item.qty + delta > product.stock) {
            alert(`Sorry, only ${product.stock} units are available in stock.`);
            return;
        }
        item.qty += delta;
        if (item.qty <= 0) {
            cart = cart.filter(x => x.id !== productId);
            if (currentUser) {
                deleteDoc(doc(db, 'Users', currentUser.id, 'Cart', productId)).catch(e => console.error(e));
            }
        } else {
            if (currentUser) {
                updateDoc(doc(db, 'Users', currentUser.id, 'Cart', productId), { qty: item.qty }).catch(e => console.error(e));
            }
        }
        saveCart();
    }
};

window.removeFromCart = function (productId) {
    cart = cart.filter(item => item.id !== productId);
    saveCart();

    if (currentUser) {
        deleteDoc(doc(db, 'Users', currentUser.id, 'Cart', productId)).catch(e => console.error("Failsync Cart Del", e));
    }
};

function updateCartUI() {
    // Dynamic price sync with inventory check
    cart.forEach(cartItem => {
        const invProduct = inventory.find(p => p.id === cartItem.id);
        if (invProduct) {
            cartItem.currentPrice = invProduct.offerPrice || invProduct.price;
        }
    });

    const totalItems = cart.reduce((sum, item) => sum + item.qty, 0);
    if (cartBadge) {
        cartBadge.textContent = totalItems;
        cartBadge.style.display = totalItems > 0 ? 'flex' : 'none';
    }

    if (!cartItemsContainer) return;

    cartItemsContainer.innerHTML = '';
    if (cart.length === 0) {
        cartItemsContainer.innerHTML = '<div class="empty-cart-msg">Your cart is empty. <br> Start exploring our collection! ✨</div>';
        if (cartTotalPrice) cartTotalPrice.textContent = '৳0.00';
        return;
    }

    let totalAmount = 0;
    cart.forEach(item => {
        totalAmount += item.currentPrice * item.qty;

        const cartItemEl = document.createElement('div');
        cartItemEl.className = 'cart-item';
        cartItemEl.innerHTML = `
            <img src="${getAbsoluteImageUrl(item.image)}" alt="${item.name}" class="cart-item-img" loading="lazy">
            <div class="cart-item-details">
                <div class="cart-item-title">${item.name}</div>
                <div class="cart-item-price">৳${item.currentPrice.toFixed(2)}</div>
                <div class="cart-item-actions">
                    <div class="qty-control">
                        <button class="qty-btn dec-btn" onclick="window.updateQty('${item.id}', -1)">-</button>
                        <span>${item.qty}</span>
                        <button class="qty-btn inc-btn" onclick="window.updateQty('${item.id}', 1)">+</button>
                    </div>
                    <button class="remove-btn" onclick="window.removeFromCart('${item.id}')">Remove</button>
                </div>
            </div>
        `;
        cartItemsContainer.appendChild(cartItemEl);
    });

    if (cartTotalPrice) cartTotalPrice.textContent = `৳${totalAmount.toFixed(2)}`;
}

function openCart() {
    if (cartSidebar) cartSidebar.classList.add('active');
    if (cartOverlay) cartOverlay.classList.add('active');
    document.body.style.overflow = 'hidden';
}

function closeCart() {
    if (cartSidebar) cartSidebar.classList.remove('active');
    if (cartOverlay) cartOverlay.classList.remove('active');
    document.body.style.overflow = '';
}

if (cartToggleBtn) cartToggleBtn.addEventListener('click', openCart);
if (closeCartBtn) closeCartBtn.addEventListener('click', closeCart);
if (cartOverlay) cartOverlay.addEventListener('click', closeCart);

// --- Theme Toggle ---
const currentTheme = localStorage.getItem('theme');
if (currentTheme && themeToggleBtn) {
    document.documentElement.setAttribute('data-theme', currentTheme);
    themeToggleBtn.querySelector('.material-icons-round').textContent = currentTheme === 'dark' ? 'light_mode' : 'dark_mode';
}

if (themeToggleBtn) {
    themeToggleBtn.addEventListener('click', () => {
        let theme = document.documentElement.getAttribute('data-theme');
        if (theme === 'dark') {
            document.documentElement.setAttribute('data-theme', 'light');
            localStorage.setItem('theme', 'light');
            themeToggleBtn.querySelector('.material-icons-round').textContent = 'dark_mode';
        } else {
            document.documentElement.setAttribute('data-theme', 'dark');
            localStorage.setItem('theme', 'dark');
            themeToggleBtn.querySelector('.material-icons-round').textContent = 'light_mode';
        }
    });
}

// --- URL Routing Utility ---
function updateUrlState(categorySlug, pageNum = 1, productSlug = null) {
    if (!categorySlug) return;

    // Ignore updates for base auth actions where categorySlug is abused
    if (['login', 'register', 'admin', 'authenticate-admin', 'Details', 'Orders'].includes(categorySlug)) {
        let newPath = `/${categorySlug}`;
        if (currentUser && (categorySlug === 'Details' || categorySlug === 'Orders')) {
            newPath = `/${currentUser.id}/${categorySlug}`;
        }
        try {
            window.history.pushState({ path: newPath }, '', newPath);
        } catch (e) {
            console.warn("pushState failed", e);
        }
        return;
    }

    let newPath = `/${categorySlug}`;
    if (currentUser) {
        newPath = `/${currentUser.id}/${categorySlug}`;
    }

    if (pageNum >= 1 && !productSlug) {
        newPath += `/page-${pageNum}`;
    }

    if (productSlug) {
        newPath += `/${productSlug}`;
    }

    // Prevent DOM Exception on file:// if serving directly via HTML
    try {
        window.history.pushState({ path: newPath }, '', newPath);
    } catch (e) {
        console.warn("pushState failed, likely not running on a server.", e);
    }
}

let routingInitialized = false;
function initRouting() {
    if (routingInitialized) return;
    routingInitialized = true;

    const path = window.location.pathname;
    const parts = path.split('/').filter(p => p.length > 0);

    // Helper functions for auth redirects
    const bounceToRoot = () => {
        currentCategorySlug = categories[0].slug;
        updateUrlState(currentCategorySlug);
    };

    if (parts.length === 0) {
        // Base URL loaded
        bounceToRoot();
    } else {
        // Deep link detection
        let maybeUser = parts[0];
        let rawAction = parts.length > 1 ? parts[1] : parts[0];
        let maybeAction = rawAction.toLowerCase();

        if (maybeAction === 'login' || maybeAction === 'register') {
            currentCategorySlug = categories[0].slug;
            if (currentUser) {
                // Already authenticated, reject Auth prompt
                bounceToRoot();
            } else {
                // Open Auth Mode
                updateUrlState(maybeAction);
                openAuthModal(maybeAction);
            }
        } else if (maybeAction === 'admin' || maybeAction === 'authenticate-admin') {
            currentCategorySlug = categories[0].slug;
            if (isAdmin) {
                updateUrlState('admin');
            } else {
                updateUrlState('authenticate-admin');
                promptPassword("Enter Admin Password", (pass) => {
                    if (pass === atob("MDEyNw==")) {
                        toggleAdminMode(true);
                    } else {
                        alert("Incorrect password.");
                    }
                });
            }
        } else if (rawAction === 'Details' || rawAction === 'Orders') {
            // Keep case-sensitive checking for Profile URLs due to IDs potentially passing here
            if (!currentUser || currentUser.id !== maybeUser) {
                // Unauthorized or not logged in, boot to base
                bounceToRoot();
            } else {
                // Authorized
                currentCategorySlug = categories[0].slug; // Load products in background
                openAuthModal('profile');
                if (maybeAction === 'Details') {
                    document.getElementById('tab-profile-details').click();
                } else if (maybeAction === 'Orders') {
                    document.getElementById('tab-profile-orders').click();
                }
            }
        } else {
            // Assume URL logic: user isn't logged in but tries /userid/cat/[page-N|prod] => rewrite
            let urlUserId = null;
            let targetCategory = null;
            let targetPage = 1;
            let targetProduct = null;

            if (categories.find(c => c.slug === parts[0])) {
                targetCategory = parts[0];
                if (parts.length > 1) {
                    if (parts[1].startsWith('page-')) {
                        targetPage = parseInt(parts[1].split('-')[1]) || 1;
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
                    } else {
                        targetProduct = parts[2];
                    }
                }
            }

            if (!currentUser && urlUserId) {
                let newPath = `/${targetCategory || categories[0].slug}`;
                if (targetPage >= 1 && !targetProduct) newPath += `/page-${targetPage}`;
                if (targetProduct) newPath += `/${targetProduct}`;
                window.history.replaceState({ path: newPath }, '', newPath);
            }

            const catExists = targetCategory && categories.find(c => c.slug === targetCategory);

            // 404 Guard: Invalid Category in URL
            if (targetCategory && !catExists) {
                window.showErrorPage(`Category "${targetCategory}" does not exist.`);
                return;
            }

            currentCategorySlug = catExists ? targetCategory : (categories.length > 0 ? categories[0].slug : null);

            currentPage = targetPage;

            if (targetProduct) {
                window.pendingProductSlug = targetProduct;
            } else {
                window.pendingProductSlug = null;
                updateUrlState(currentCategorySlug, currentPage);
            }
        }
    }

    renderCategoryTabs();
    loadInventoryItems();
}

window.addEventListener('popstate', (e) => {
    // Pseudo routing back button support
    console.log("Navigated via history", location.pathname);
    // Future expansion: Parse location.pathname to switch categories natively on back button hit
});

// --- Category Click Routing Hook ---
// (We already trigger this via renderCategoryTabs when a category is clicked)

// --- Product View Engine ---
const productViewSection = document.getElementById('product-view');
const shopSection = document.getElementById('shop');
const backToShopBtn = document.getElementById('back-to-shop-btn');
const pvMainImage = document.getElementById('pv-main-image');
const pvThumbnails = document.getElementById('pv-thumbnails');
const pvCategory = document.getElementById('pv-category');
const pvTitle = document.getElementById('pv-title');
const pvPrice = document.getElementById('pv-price');
const pvDescription = document.getElementById('pv-description');
const pvQty = document.getElementById('pv-qty');
const pvQtyDec = document.getElementById('pv-qty-dec');
const pvQtyInc = document.getElementById('pv-qty-inc');
const pvStockStatus = document.getElementById('pv-stock-status');
const pvAddToCart = document.getElementById('pv-add-to-cart');
const pvAdminActions = document.getElementById('pv-admin-actions');
const pvAdminEdit = document.getElementById('pv-admin-edit');
const imageExpanderModal = document.getElementById('image-expander-modal');
const expandedImage = document.getElementById('expanded-image');
const closeImageExpander = document.getElementById('close-image-expander');

let currentViewedProduct = null;
let pvCurrentQty = 1;

window.renderProductPage = function (productSlug) {
    const product = inventory.find(p => p.slug === productSlug);
    if (!product) {
        window.showErrorPage(`Product could not be found.`);
        return;
    }

    currentViewedProduct = product;
    pvCurrentQty = 1;

    shopSection.style.display = 'none';
    productViewSection.style.display = 'block';
    if (errorViewSection) errorViewSection.style.display = 'none';

    pvCategory.textContent = getCategoryNameFromSlug(product.categoryId);
    pvTitle.textContent = product.name;
    pvDescription.textContent = product.description || 'No description available.';

    // Pricing
    const currentPrice = product.offerPrice || product.price;
    pvPrice.textContent = `৳${currentPrice.toFixed(2)}`;

    // Images
    const allImages = (product.images && product.images.length > 0) ? product.images : (product.image ? [product.image] : ['/assets/placeholder.jpg']);
    pvMainImage.src = getAbsoluteImageUrl(allImages[0]);
    pvThumbnails.innerHTML = '';

    allImages.forEach((imgUrl, idx) => {
        const thumb = document.createElement('img');
        thumb.src = getAbsoluteImageUrl(imgUrl);
        if (idx === 0) thumb.classList.add('active');
        thumb.onclick = () => {
            pvMainImage.src = thumb.src;
            pvThumbnails.querySelectorAll('img').forEach(img => img.classList.remove('active'));
            thumb.classList.add('active');
        };
        pvThumbnails.appendChild(thumb);
    });

    // Stock logic
    pvQty.textContent = '1';
    pvAddToCart.disabled = false;
    pvAddToCart.style.opacity = '1';
    if (product.stock === 0) {
        pvStockStatus.textContent = 'Out of Stock';
        pvStockStatus.style.color = '#ff4444';
        pvAddToCart.disabled = true;
        pvAddToCart.style.opacity = '0.5';
    } else if (product.stock > 0 && product.stock <= 3) {
        pvStockStatus.textContent = `Only ${product.stock} left`;
        pvStockStatus.style.color = '#ff9800';
    } else {
        pvStockStatus.textContent = 'In Stock';
        pvStockStatus.style.color = 'var(--text-muted)';
    }

    // Admin logic
    if (isAdmin) {
        pvAdminActions.style.display = 'block';
        pvAdminEdit.onclick = () => {
            window.openEditModal(product.id);
        };
    } else {
        pvAdminActions.style.display = 'none';
    }

    // Update URL
    const route = `${product.categorySlug}/${product.slug}`;
    if (!window.location.pathname.endsWith(route)) {
        updateUrlState(route);
    }

    window.scrollTo({ top: 0, behavior: 'smooth' });
};

if (backToShopBtn) {
    backToShopBtn.addEventListener('click', () => {
        productViewSection.style.display = 'none';
        shopSection.style.display = 'block';
        if (errorViewSection) errorViewSection.style.display = 'none';
        if (currentCategorySlug) {
            updateUrlState(currentCategorySlug);
        }
    });
}

pvQtyInc?.addEventListener('click', () => {
    if (currentViewedProduct && currentViewedProduct.stock !== undefined && pvCurrentQty >= currentViewedProduct.stock) {
        alert(`Only ${currentViewedProduct.stock} units available.`);
        return;
    }
    pvCurrentQty++;
    pvQty.textContent = pvCurrentQty;
});

pvQtyDec?.addEventListener('click', () => {
    if (pvCurrentQty > 1) {
        pvCurrentQty--;
        pvQty.textContent = pvCurrentQty;
    }
});

pvAddToCart?.addEventListener('click', () => {
    if (!currentViewedProduct) return;
    for (let i = 0; i < pvCurrentQty; i++) {
        window.addCartItem(currentViewedProduct.id);
    }
    alert(`Added ${pvCurrentQty} item(s) to your cart.`);
    pvCurrentQty = 1;
    pvQty.textContent = pvCurrentQty;
});

pvMainImage?.parentElement.addEventListener('click', () => {
    expandedImage.src = pvMainImage.src;
    imageExpanderModal.style.display = 'flex';
});

closeImageExpander?.addEventListener('click', () => {
    imageExpanderModal.style.display = 'none';
});

// --- Checkout & Orders Flow ---

function calculateDeliveryCharge(district, totalItems) {
    if (districtsArrayEmpty(totalItems)) return 0;

    // Fallback in case rules haven't loaded yet
    if (!deliveryRules || Object.keys(deliveryRules).length === 0) {
        return 130;
    }

    let ruleset = deliveryRules[district];
    if (!ruleset) {
        ruleset = deliveryRules['default'];
    }

    if (!ruleset) return 130; // ultimate fallback

    for (let tier of ruleset.tiers || []) {
        if (totalItems <= tier.maxItems) {
            return tier.charge;
        }
    }

    const maxTierItems = ruleset.tiers && ruleset.tiers.length > 0 ?
        ruleset.tiers[ruleset.tiers.length - 1].maxItems : 10;

    const extraCount = totalItems - maxTierItems;
    if (extraCount > 0) {
        return ruleset.baseChargeOver10 + Math.ceil(extraCount / 10) * ruleset.extraChargePer10Items;
    }

    return ruleset.baseChargeOver10;
}

function districtsArrayEmpty(total) {
    return total <= 0;
}

const checkoutBtn = document.getElementById('checkout-btn');

if (checkoutBtn) {
    checkoutBtn.addEventListener('click', () => {
        if (cart.length === 0) {
            alert("Your cart is empty.");
            return;
        }

        if (!currentUser) {
            openGuestModal();
        } else {
            openCheckoutView();
        }
    });
}

function openGuestModal() {
    closeCart();
    guestModal.style.display = 'flex';

    // Populate Steadfast Dropdowns natively for Guests
    if (Object.keys(steadfastLocations).length > 0) {
        const districts = Object.keys(steadfastLocations).filter(d => d !== "Dhaka City" && d !== "Dhaka Sub-Urban");
        districts.push("Dhaka");
        districts.sort();

        // Prevent infinitely duplicate options if modal opened multiple times
        guestDistrict.innerHTML = '<option value="" disabled selected>Select District</option>';
        districts.forEach(d => {
            const opt = document.createElement('option');
            opt.value = d;
            opt.textContent = d;
            guestDistrict.appendChild(opt);
        });

        // If there's an existing valid selection that got wiped out, or we want to reset thana:
        guestThana.innerHTML = '<option value="" disabled selected>Select Thana</option>';
        guestThana.disabled = true;
    }

    // Bind Login redirect
    if (guestModalLoginLink) {
        // Clone to remove old listeners
        const clonedLink = guestModalLoginLink.cloneNode(true);
        guestModalLoginLink.parentNode.replaceChild(clonedLink, guestModalLoginLink);

        clonedLink.addEventListener('click', (e) => {
            e.preventDefault();
            guestModal.style.display = 'none';
            openAuthModal('login');
        });
    }

    guestDistrict.addEventListener('change', (e) => {
        const selected = e.target.value;
        guestThana.innerHTML = '<option value="" disabled selected>Select Thana</option>';
        guestThana.disabled = false;
        guestThana.style.background = 'var(--bg-card)';
        guestThana.style.cursor = 'pointer';

        let thanas = [];
        if (selected === "Dhaka") {
            thanas = [...(steadfastLocations["Dhaka City"] || []), ...(steadfastLocations["Dhaka Sub-Urban"] || [])];
        } else if (steadfastLocations[selected]) {
            thanas = steadfastLocations[selected];
        }

        thanas.sort().forEach(t => {
            const opt = document.createElement('option');
            opt.value = t;
            opt.textContent = t;
            guestThana.appendChild(opt);
        });
    });

    // Close Guest Modal
    if (closeGuestModalBtn) {
        closeGuestModalBtn.onclick = () => { guestModal.style.display = 'none'; };
    }

    // Submit Guest Modal (use Event Listener and ensure no duplicates)
    guestCheckoutForm.onsubmit = null; // Clear any old direct assignments just in case
    // We remove any previously bound listener by cloning the form to guarantee a pure state
    const newGuestForm = guestCheckoutForm.cloneNode(true);
    guestCheckoutForm.parentNode.replaceChild(newGuestForm, guestCheckoutForm);

    newGuestForm.addEventListener('submit', (e) => {
        e.preventDefault();

        // Need to re-query elements since we cloned the form
        const newGuestNameInput = document.getElementById('guest-name');
        const newGuestMobileInput = document.getElementById('guest-mobile');
        const newGuestAddressInput = document.getElementById('guest-address');
        const newGuestDistrict = document.getElementById('guest-district');
        const newGuestThana = document.getElementById('guest-thana');

        currentGuest = {
            name: newGuestNameInput.value.trim(),
            mobile: newGuestMobileInput.value.trim(),
            address: newGuestAddressInput.value.trim(),
            district: newGuestDistrict.value,
            thana: newGuestThana.value
        };

        guestModal.style.display = 'none';
        openCheckoutView();
    });
}

function openCheckoutView() {
    closeCart();
    mainLayoutContainer.style.display = 'none';
    checkoutView.style.display = 'block';

    // Peek Invoice logic
    updateUrlState('Checkout...');
    let currentUserId = currentUser ? currentUser.id : "guest";
    getDoc(doc(db, 'Counters', 'InvoiceCounter')).then(docSnap => {
        let proposed = 2637;
        if (docSnap.exists()) {
            proposed = docSnap.data().lastInvoice + 1;
        }
        // Update URL to /{UserID}/{ProposedInvoiceNumber}
        try {
            const draftPath = `/${currentUserId}/${proposed}`;
            window.history.pushState({ path: draftPath }, '', draftPath);
        } catch (e) { }
    }).catch(err => console.log("Silent error reading counter predict", err));

    // Populate User Details Statically
    if (checkoutUserDetails) {
        const activeTarget = currentUser || currentGuest;
        if (activeTarget) {
            checkoutUserDetails.innerHTML = `
                <p><strong>Name:</strong> ${activeTarget.name}</p>
                <p><strong>Mobile:</strong> ${activeTarget.mobile || 'Not provided'}</p>
                <p><strong>District:</strong> ${activeTarget.district || 'Not provided'}</p>
                <p><strong>Thana:</strong> ${activeTarget.thana || 'Not provided'}</p>
                <p><strong>Delivery Address:</strong><br>${activeTarget.address || 'Not provided'}</p>
            `;
        }
    }

    // Populate Items & Total
    if (checkoutItemsList) {
        checkoutItemsList.innerHTML = '';
        let total = 0;
        cart.forEach(item => {
            total += item.currentPrice * item.qty;
            const el = document.createElement('div');
            el.style.cssText = "display: flex; gap: 1rem; align-items: center; border-bottom: 1px dashed var(--border-color); padding-bottom: 0.5rem;";
            el.innerHTML = `
                <img src="${getAbsoluteImageUrl(item.image)}" style="width: 50px; height: 50px; object-fit: cover; border-radius: var(--radius-sm);" loading="lazy">
                <div style="flex-grow: 1;">
                    <h4 style="margin: 0; font-size: 0.95rem;">${item.name}</h4>
                    <span style="font-size: 0.85rem; color: var(--text-muted);">Qty: ${item.qty}</span>
                </div>
                <div style="font-weight: bold;">৳${(item.currentPrice * item.qty).toFixed(2)}</div>
            `;
            checkoutItemsList.appendChild(el);
        });

        const recalcCheckoutTotals = () => {
            let currentDistrict = "";
            const activeTarget = currentUser || currentGuest;
            if (activeTarget && activeTarget.district) {
                // If the user selected "Dhaka" mathematically map to the true district for fees
                if (activeTarget.district === "Dhaka") {
                    currentDistrict = getTrueDistrict(activeTarget.district, activeTarget.thana);
                } else {
                    currentDistrict = activeTarget.district;
                }
            }

            const totalItems = cart.reduce((sum, item) => sum + item.qty, 0);
            const deliveryCharge = calculateDeliveryCharge(currentDistrict, totalItems);
            const grandTotal = total + deliveryCharge;

            if (checkoutSubtotalPrice) checkoutSubtotalPrice.textContent = `৳${total.toFixed(2)}`;
            if (checkoutDeliveryCharge) checkoutDeliveryCharge.textContent = `৳${deliveryCharge.toFixed(2)}`;
            if (checkoutTotalPrice) checkoutTotalPrice.textContent = `৳${grandTotal.toFixed(2)}`;
            checkoutConfirmBtn.setAttribute('data-total', grandTotal);
            checkoutConfirmBtn.setAttribute('data-delivery', deliveryCharge);
        };

        // Initial calculation on mount
        recalcCheckoutTotals();

        // Store it globally so other functions can trigger it safely if needed
        window.recalcCheckoutTotals = recalcCheckoutTotals;
    }
}

if (checkoutCancelBtn) {
    checkoutCancelBtn.addEventListener('click', () => {
        checkoutView.style.display = 'none';
        mainLayoutContainer.style.display = 'block';
    });
}

if (checkoutConfirmBtn) {
    checkoutConfirmBtn.addEventListener('click', async () => {
        if (cart.length === 0) return;

        // Extract Buyer Data
        let orderUserId = "guest";
        let orderUsername = "";
        let orderMobile = "";
        let orderAddress = "";
        let orderDistrict = "";
        let orderThana = "";

        if (currentUser) {
            orderUserId = currentUser.id;
            orderUsername = currentUser.name || "Unknown User";
            orderMobile = currentUser.mobile || "";
            orderAddress = currentUser.address || "";
            orderDistrict = currentUser.district || "Default";
            orderThana = currentUser.thana || "Default";
        } else if (currentGuest) {
            if (!currentGuest.name || !currentGuest.mobile ||
                !currentGuest.address || !currentGuest.district || !currentGuest.thana) {
                alert("Guest details incomplete. Please restart checkout.");
                return;
            }

            orderUsername = currentGuest.name;
            orderMobile = currentGuest.mobile;
            orderAddress = currentGuest.address;

            // Map the True District securely the same way registered profiles do it
            orderDistrict = getTrueDistrict(currentGuest.district, currentGuest.thana);
            orderThana = currentGuest.thana;
        } else {
            alert("Please provide shipping details before confirming.");
            return;
        }

        checkoutConfirmBtn.disabled = true;
        checkoutConfirmBtn.textContent = "Processing...";

        try {
            const payloadItemsQty = cart.reduce((sum, item) => sum + item.qty, 0);
            const activeTarget = currentUser || currentGuest || {};
            let currentDistrictCalc = activeTarget.district || "";
            if (currentDistrictCalc === "Dhaka") {
                currentDistrictCalc = getTrueDistrict(activeTarget.district, activeTarget.thana);
            }
            const secureDeliveryCharge = calculateDeliveryCharge(currentDistrictCalc, payloadItemsQty);
            const rawSubtotal = cart.reduce((sum, item) => sum + (item.currentPrice * item.qty), 0);
            const secureGrandTotal = rawSubtotal + secureDeliveryCharge;

            const orderPayload = {
                userId: orderUserId,
                username: orderUsername,
                mobile: orderMobile,
                address: orderAddress,
                district: orderDistrict,
                thana: orderThana,
                items: cart.map(i => ({ id: i.id, name: i.name, price: i.currentPrice, qty: i.qty })),
                subtotal: rawSubtotal,
                deliveryCharge: secureDeliveryCharge,
                totalPrice: secureGrandTotal,
                status: 'Pending',
                createdAt: Date.now()
            };

            // Secure Transactional Invoice Generator
            const counterRef = doc(db, 'Counters', 'InvoiceCounter');

            const secureInvoiceId = await runTransaction(db, async (transaction) => {
                const counterDoc = await transaction.get(counterRef);
                // 2636 ensures the next starting counter is 2637 per specs
                let nextInvoice = 2636;
                if (counterDoc.exists()) {
                    nextInvoice = counterDoc.data().lastInvoice;
                }

                nextInvoice += 1;
                transaction.set(counterRef, { lastInvoice: nextInvoice }, { merge: true });
                return nextInvoice.toString();
            });

            // Assign the exact secure invoice sequence to order ID
            const newOrderRef = doc(db, 'Orders', secureInvoiceId);

            // Reassign the visual ID payload param so we store it internally as well
            orderPayload.id = secureInvoiceId;

            const batch = writeBatch(db);
            batch.set(newOrderRef, orderPayload);

            if (currentUser) {
                const userOrderRef = doc(db, 'Users', currentUser.id, 'Orders', secureInvoiceId);
                batch.set(userOrderRef, orderPayload);
            }

            await batch.commit();

            alert("Order Confirmed! Your Invoice Number is: " + secureInvoiceId);

            // Wipe Firebase Cart if logged in
            if (currentUser) {
                const wipeBatch = writeBatch(db);
                cart.forEach(item => {
                    wipeBatch.delete(doc(db, 'Users', currentUser.id, 'Cart', item.id));
                });
                await wipeBatch.commit().catch(e => console.error("Silent Cart Wipe Failure", e));
            }

            // Empty Cart Locally
            cart = [];
            saveCart();

            // Return to main view
            checkoutView.style.display = 'none';
            mainLayoutContainer.style.display = 'block';

        } catch (err) {
            console.error("Order Failed:", err);
            alert("Error communicating with the database during checkout.");
        }

        checkoutConfirmBtn.disabled = false;
        checkoutConfirmBtn.textContent = "Confirm Order";
    });
}

// --- Profile Order Loader ---
async function loadProfileOrders() {
    if (!profileOrdersList || !currentUser) return;
    profileOrdersList.innerHTML = '<div style="color: var(--text-muted); font-size: 0.9rem;">Loading orders...</div>';

    try {
        const q = query(collection(db, 'Orders'), where('userId', '==', currentUser.id));
        const snapshots = await getDocs(q);

        profileOrdersList.innerHTML = '';
        if (snapshots.empty) {
            profileOrdersList.innerHTML = '<div style="color: var(--text-muted); font-size: 0.9rem;">No past orders found.</div>';
            return;
        }

        // Sort locally descending since we didn't build a complex index yet
        const orders = snapshots.docs.map(d => ({ id: d.id, ...d.data() })).sort((a, b) => b.createdAt - a.createdAt);

        orders.forEach(order => {
            const dateStr = new Date(order.createdAt).toLocaleDateString();
            const el = document.createElement('div');
            el.style.cssText = "background: var(--bg-main); border: 1px solid var(--border-color); border-radius: var(--radius-sm); padding: 1rem;";

            let itemsHtml = order.items.map(i => `<li>${i.qty}x ${i.name} (৳${i.price})</li>`).join('');

            el.innerHTML = `
                <div style="display: flex; justify-content: space-between; border-bottom: 1px dashed var(--border-color); padding-bottom: 0.5rem; margin-bottom: 0.5rem; font-size: 0.9rem;">
                    <strong>ID: ${order.id.slice(0, 8)}...</strong>
                    <span style="color: var(--primary); font-weight: bold;">${order.status}</span>
                </div>
                <div style="font-size: 0.85rem; color: var(--text-muted); margin-bottom: 0.5rem;">Ordered on ${dateStr}</div>
                <ul style="margin: 0; padding-left: 1rem; font-size: 0.85rem; color: var(--text-main); margin-bottom: 0.5rem;">
                    ${itemsHtml}
                </ul>
                <div style="text-align: right; font-weight: bold; font-size: 1rem; color: var(--text-main);">
                    Total: ৳${order.totalPrice.toFixed(2)}
                </div>
            `;
            profileOrdersList.appendChild(el);
        });

    } catch (err) {
        console.error("Failed to load orders:", err);
        profileOrdersList.innerHTML = '<div style="color: #ff4444; font-size: 0.9rem;">Failed to fetch history.</div>';
    }
}

// --- Admin Orders Engine ---
const adminOrdersBtn = document.getElementById('admin-orders-btn');
const adminOrdersCloseBtn = document.getElementById('admin-orders-close-btn');
const adminOrdersView = document.getElementById('admin-orders-view');
const adminOrdersList = document.getElementById('admin-orders-list');

if (adminOrdersBtn) {
    adminOrdersBtn.addEventListener('click', () => {
        closeCart();
        mainLayoutContainer.style.display = 'none';
        if (checkoutView) checkoutView.style.display = 'none';
        adminOrdersView.style.display = 'block';
        loadAdminOrders();
    });
}

if (adminOrdersCloseBtn) {
    adminOrdersCloseBtn.addEventListener('click', () => {
        adminOrdersView.style.display = 'none';
        mainLayoutContainer.style.display = 'block';
    });
}

async function loadAdminOrders() {
    if (!adminOrdersList) return;
    adminOrdersList.innerHTML = '<div style="color: var(--text-muted);">Fetching systems orders...</div>';

    try {
        const snapshots = await getDocs(collection(db, 'Orders'));
        adminOrdersList.innerHTML = '';

        if (snapshots.empty) {
            adminOrdersList.innerHTML = '<div style="color: var(--text-muted);">No orders in the system.</div>';
            return;
        }

        const orders = snapshots.docs.map(d => ({ id: d.id, ...d.data() })).sort((a, b) => b.createdAt - a.createdAt);

        orders.forEach(order => {
            const dateStr = new Date(order.createdAt).toLocaleString();
            const itemsHTML = order.items.map(i => `• ${i.name} (x${i.qty}) - ৳${i.price.toFixed(2)}`).join('<br>');

            const li = document.createElement('div');
            li.style.cssText = `padding: 1rem; border: 1px solid var(--border-color); border-radius: var(--radius-sm); display: flex; flex-direction: column; gap: 0.5rem; background: var(--bg-card); margin-bottom: 1rem;`;

            const statusColor = order.status === 'Delivered' ? '#00c853' : (order.status === 'Sent' ? '#2979ff' : '#ff9100');

            li.innerHTML = `
                <div style="display: flex; justify-content: space-between; border-bottom: 1px solid var(--border-color); padding-bottom: 0.5rem; flex-wrap: wrap;">
                    <div><strong>Order ID:</strong> ${order.id}</div>
                    <div style="font-size: 0.85rem; color: var(--text-muted);">${dateStr}</div>
                </div>
                <div style="display: grid; grid-template-columns: 1fr 1fr; gap: 1rem; margin-top: 0.5rem;">
                    <div>
                        <div style="font-weight: 600; font-size: 0.9rem;">Customer Info</div>
                        <div style="font-size: 0.9rem; color: var(--text-muted);">
                            ${order.username} (${order.userId})<br>
                            Mobile: ${order.mobile || 'N/A'}<br>
                            Address: ${order.address}
                        </div>
                    </div>
                    <div>
                        <div style="font-weight: 600; font-size: 0.9rem;">Order Items</div>
                        <div style="font-size: 0.9rem; color: var(--text-muted);">${itemsHTML}</div>
                    </div>
                </div>
                <div style="display: flex; justify-content: space-between; align-items: center; margin-top: 0.5rem; border-top: 1px dashed var(--border-color); padding-top: 0.5rem;">
                    <div style="font-weight: 600;">Total: ৳${order.totalPrice.toFixed(2)}</div>
                    <div style="display: flex; gap: 10px; align-items: center;">
                        <span style="font-size: 0.9rem; font-weight: bold; color: ${statusColor};">Status:</span>
                        <select class="admin-status-dropdown" data-id="${order.id}" data-userid="${order.userId}" style="padding: 0.25rem 0.5rem; border-radius: 4px; border: 1px solid var(--border-color); background: var(--bg-hover); color: var(--text-main); font-family: inherit;">
                            <option value="Pending" ${order.status === 'Pending' ? 'selected' : ''}>Pending</option>
                            <option value="Sent" ${order.status === 'Sent' ? 'selected' : ''}>Sent</option>
                            <option value="Delivered" ${order.status === 'Delivered' ? 'selected' : ''}>Delivered</option>
                        </select>
                    </div>
                </div>
            `;
            adminOrdersList.appendChild(li);
        });

        // Attach listeners for status changes
        document.querySelectorAll('.admin-status-dropdown').forEach(sel => {
            sel.addEventListener('change', async (e) => {
                const oid = e.target.getAttribute('data-id');
                const uid = e.target.getAttribute('data-userid');
                const newStatus = e.target.value;
                try {
                    const batch = writeBatch(db);
                    batch.update(doc(db, 'Orders', oid), { status: newStatus });
                    batch.update(doc(db, 'Users', uid, 'Orders', oid), { status: newStatus });
                    await batch.commit();

                    const spanLbl = e.target.previousElementSibling;
                    spanLbl.style.color = newStatus === 'Delivered' ? '#00c853' : (newStatus === 'Sent' ? '#2979ff' : '#ff9100');
                } catch (err) {
                    console.error("Status Update Failed", err);
                    alert("Failed to update status");
                }
            });
        });

    } catch (e) {
        console.error("Admin Load Orders Error", e);
        adminOrdersList.innerHTML = '<div style="color: #ff4444;">Failed to load orders. Check console.</div>';
    }
}
