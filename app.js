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
const registerRememberInput = document.getElementById('register-remember');
const registerSubmitBtn = document.getElementById('register-submit-btn');
const showLoginBtn = document.getElementById('show-login-btn');

// Profile Form Elements
const profileForm = document.getElementById('profile-form');
const profileUsernameInput = document.getElementById('profile-username');
const profileUseridInput = document.getElementById('profile-userid');
const profileMobileInput = document.getElementById('profile-mobile');
const profileAddressInput = document.getElementById('profile-address');
const profileOrdersList = document.getElementById('profile-orders-list');
const profileUpdateBtn = document.getElementById('profile-update-btn');
const authLogoutBtn = document.getElementById('auth-logout-btn');

// Admin Elements
const siteTitle = document.getElementById('site-title');
const adminToolsBanner = document.getElementById('admin-tools-banner');
const adminLogoutBtn = document.getElementById('admin-logout-btn');
const homeTitle = document.getElementById('home-title');
const homeSubtitle = document.getElementById('home-subtitle');
const adminHeaderEditContainer = document.getElementById('admin-header-edit-container');
const adminEditHeaderBtn = document.getElementById('admin-edit-header-btn');

// Checkout View Elements
const checkoutView = document.getElementById('checkout-view');
const checkoutUserDetails = document.getElementById('checkout-user-details');
const checkoutItemsList = document.getElementById('checkout-items-list');
const checkoutTotalPrice = document.getElementById('checkout-total-price');
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
    if (homeTitle) homeTitle.textContent = homeTitleText;
    if (homeSubtitle) homeSubtitle.textContent = homeSubtitleText;

    toggleAdminMode(isAdmin);

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
                    price: parseFloat(data.price),
                    offerPrice: data.offerPrice ? parseFloat(data.offerPrice) : null,
                    image: data.image,
                    isNew: data.isNew || false,
                    isSale: data.isSale || false
                });
            });

            // Re-render the grid if we are currently looking at this category
            if (cat.slug === currentCategorySlug) {
                renderProducts(currentCategorySlug);
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

function renderProducts(categorySlug) {
    if (!productGrid) return;
    productGrid.innerHTML = '';

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
        return;
    }

    filteredProducts.forEach(product => {
        const hasOffer = product.offerPrice !== null && product.offerPrice > 0;
        const priceDisplay = hasOffer ?
            `<span class="product-price">৳${product.offerPrice.toFixed(2)}</span><span class="price-strike">৳${product.price.toFixed(2)}</span>` :
            `<span class="product-price">৳${product.price.toFixed(2)}</span>`;

        let badges = '';
        if (product.isSale) badges += `<div class="product-badge badge-sale">SALE</div>`;
        else if (product.isNew) badges += `<div class="product-badge badge-new">NEW</div>`;

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
            <div class="product-img-wrap">
                ${badges}
                ${imgDisplay}
            </div>
            <div class="product-info">
                <div class="product-category">${product.categoryId}</div>
                <h3 class="product-title">${product.name || 'Unnamed Product'}</h3>
                <div class="product-footer">
                    <div class="product-price-wrap">
                        ${priceDisplay}
                    </div>
                    <button class="add-to-cart" onclick="window.addCartItem('${product.id}')" aria-label="Add to cart">
                        <span class="material-icons-round">add_shopping_cart</span>
                    </button>
                </div>
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
        return;
    }

    if (currentUser) {
        if (authLoginBtn) authLoginBtn.style.display = 'none';
        if (userProfileBadge) {
            userProfileBadge.style.display = 'flex';
            userProfileName.textContent = currentUser.name || currentUser.id;
        }
    } else {
        if (authLoginBtn) authLoginBtn.style.display = 'block';
        if (userProfileBadge) userProfileBadge.style.display = 'none';
        // Enforce path fallback if session expires or logs out
        if (routingInitialized && categories.length > 0) {
            updateUrlState(currentCategorySlug || categories[0].slug);
        }
    }
}

function openAuthModal(view = 'login') {
    if (loginForm) loginForm.reset();
    if (registerForm) registerForm.reset();
    if (profileForm) profileForm.reset();

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
        const remember = registerRememberInput.checked;

        if (!username || !userid || !password || !mobile || userid.includes("Checking")) {
            alert("Please fill all fields and wait for ID validation.");
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
                await setDoc(userRef, {
                    username: username,
                    mobile: mobile,
                    password: password,
                    address: address,
                    createdAt: Date.now()
                });

                currentUser = { id: userid, name: username, mobile: mobile, address: address };
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

        if (!currentUser) return;

        profileUpdateBtn.disabled = true;
        profileUpdateBtn.textContent = "Updating...";

        try {
            await updateDoc(doc(db, 'Users', currentUser.id), { address: newAddress, mobile: newMobile });
            currentUser.address = newAddress;
            currentUser.mobile = newMobile;

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
            updateUserUI();
        }
        if (adminToolsBanner) adminToolsBanner.style.display = 'flex';
        if (adminHeaderEditContainer) adminHeaderEditContainer.style.display = 'block';
    } else {
        if (adminToolsBanner) adminToolsBanner.style.display = 'none';
        if (adminHeaderEditContainer) adminHeaderEditContainer.style.display = 'none';
    }

    renderCategoryTabs();
    renderProducts(currentCategorySlug);
}

// Secret Admin Login Trigger (Hold 'Toy & Craft' logic for 2 seconds)
let holdTimer = null;
if (siteTitle) {
    const startHold = (e) => {
        if (e.type === 'mousedown' && e.button !== 0) return;

        holdTimer = setTimeout(() => {
            if (!isAdmin) {
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
}

if (adminLogoutBtn) {
    adminLogoutBtn.addEventListener('click', () => toggleAdminMode(false));
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
        if (adminHeaderTitleInput) adminHeaderTitleInput.value = homeTitleText || homeTitleDefault;
        if (adminHeaderSubtitleInput) adminHeaderSubtitleInput.value = homeSubtitleText;
        if (headerModal) headerModal.style.display = 'flex';
    });
}

const closeHeaderModalFn = () => { if (headerModal) headerModal.style.display = 'none'; };
if (closeHeaderModalBtn) closeHeaderModalBtn.addEventListener('click', closeHeaderModalFn);
if (headerCancelBtn) headerCancelBtn.addEventListener('click', closeHeaderModalFn);

if (adminHeaderForm) {
    adminHeaderForm.addEventListener('submit', (e) => {
        e.preventDefault();
        homeTitleText = adminHeaderTitleInput.value.trim();
        homeSubtitleText = adminHeaderSubtitleInput.value.trim();

        if (homeTitle) homeTitle.textContent = homeTitleText;
        if (homeSubtitle) homeSubtitle.textContent = homeSubtitleText;

        localStorage.setItem('tc_home_title', homeTitleText);
        localStorage.setItem('tc_home_subtitle', homeSubtitleText);

        closeHeaderModalFn();
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
        if (adminProductImage) adminProductImage.value = product.image;
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
        const productData = {
            name: adminProductName.value.trim(),
            price: parseFloat(adminProductPrice.value),
            offerPrice: isNaN(offerVal) ? null : offerVal,
            image: adminProductImage.value.trim(),
            isNew: adminProductNew.checked,
            isSale: adminProductSale.checked,
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

    const existingItem = cart.find(item => item.id === productId);
    let targetPayload = null;

    if (existingItem) {
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
    if (item) {
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
function updateUrlState(pathSegment) {
    let newPath = '';
    if (currentUser) {
        newPath = `/${currentUser.id}/${pathSegment}`;
    } else {
        newPath = `/${pathSegment}`;
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
            // Assume it's a category slug
            // Note: If maybeUser is the slug, we verify if it exists
            let targetCategory = parts[0];
            if (currentUser && parts.length > 1) {
                targetCategory = parts[1];
            }

            const catExists = categories.find(c => c.slug === targetCategory);
            if (catExists) {
                currentCategorySlug = targetCategory;
            } else {
                currentCategorySlug = categories[0].slug;
            }
            updateUrlState(currentCategorySlug);
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

// --- Checkout & Orders Flow ---
const checkoutBtn = document.getElementById('checkout-btn');

if (checkoutBtn) {
    checkoutBtn.addEventListener('click', () => {
        if (!currentUser) {
            alert("Please login to proceed to checkout.");
            closeCart();
            openAuthModal('login');
            return;
        }

        if (cart.length === 0) {
            alert("Your cart is empty.");
            return;
        }

        // Setup Checkout View
        closeCart();
        mainLayoutContainer.style.display = 'none';
        checkoutView.style.display = 'block';

        // Peek Invoice logic
        updateUrlState('Checkout...');
        getDoc(doc(db, 'Counters', 'InvoiceCounter')).then(docSnap => {
            let proposed = 2637;
            if (docSnap.exists()) {
                proposed = docSnap.data().lastInvoice + 1;
            }
            // Update URL to /{UserID}/{ProposedInvoiceNumber}
            try {
                const draftPath = `/${currentUser.id}/${proposed}`;
                window.history.pushState({ path: draftPath }, '', draftPath);
            } catch (e) { }
        }).catch(err => console.log("Silent error reading counter predict", err));

        // Populate User Details
        if (checkoutUserDetails) {
            checkoutUserDetails.innerHTML = `
                <p><strong>Name:</strong> ${currentUser.name}</p>
                <p><strong>Mobile:</strong> ${currentUser.mobile || 'Not provided'}</p>
                <p><strong>Delivery Address:</strong><br>${currentUser.address || 'Not provided'}</p>
            `;
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
            if (checkoutTotalPrice) checkoutTotalPrice.textContent = `৳${total.toFixed(2)}`;
            checkoutConfirmBtn.setAttribute('data-total', total);
        }
    });
}

if (checkoutCancelBtn) {
    checkoutCancelBtn.addEventListener('click', () => {
        checkoutView.style.display = 'none';
        mainLayoutContainer.style.display = 'block';
    });
}

if (checkoutConfirmBtn) {
    checkoutConfirmBtn.addEventListener('click', async () => {
        if (!currentUser || cart.length === 0) return;

        checkoutConfirmBtn.disabled = true;
        checkoutConfirmBtn.textContent = "Processing...";

        try {
            const orderPayload = {
                userId: currentUser.id,
                username: currentUser.name,
                mobile: currentUser.mobile || '',
                address: currentUser.address,
                items: cart.map(i => ({ id: i.id, name: i.name, price: i.currentPrice, qty: i.qty })),
                totalPrice: parseFloat(checkoutConfirmBtn.getAttribute('data-total')),
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
            const userOrderRef = doc(db, 'Users', currentUser.id, 'Orders', secureInvoiceId);

            // Reassign the visual ID payload param so we store it internally as well
            orderPayload.id = secureInvoiceId;

            const batch = writeBatch(db);
            batch.set(newOrderRef, orderPayload);
            batch.set(userOrderRef, orderPayload);

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
