import { state, updateCart } from '../core/state.js';
import { db, doc, getDoc, getDocs, setDoc, deleteDoc, updateDoc, collection, writeBatch, runTransaction } from '../config/firebase.js';
import { getAbsoluteImageUrl } from '../core/utils.js';
import { openAuthModal } from './auth.js';
import {
    cartBadge, cartItemsContainer, cartTotalPrice, cartSidebar, cartOverlay,
    cartToggleBtn, closeCartBtn,
    checkoutBtn, guestModal, guestDistrict, guestThana, guestModalLoginLink,
    closeGuestModalBtn, guestCheckoutForm, checkoutView, mainLayoutContainer,
    checkoutUserDetails, checkoutItemsList, checkoutSubtotalPrice, checkoutDeliveryCharge,
    checkoutTotalPrice, checkoutConfirmBtn, checkoutCancelBtn
} from '../core/dom.js';

// --- Helper ---
export function getTrueDistrict(districtValue, thanaValue) {
    if (districtValue === "Dhaka") {
        if (state.steadfastLocations["Dhaka City"]?.includes(thanaValue)) return "Dhaka City";
        if (state.steadfastLocations["Dhaka Sub-Urban"]?.includes(thanaValue)) return "Dhaka Sub-Urban";
    }
    return districtValue;
}
window.getTrueDistrict = getTrueDistrict;

// --- Cart Selection Helpers ---

function isItemSelected(itemId) {
    // Default: selected (true) unless explicitly set to false
    return state.cartSelections[itemId] !== false;
}

function setItemSelected(itemId, selected) {
    state.cartSelections[itemId] = selected;
    // Persist to Firebase if logged in
    if (state.currentUser) {
        setDoc(doc(db, 'Users', state.currentUser.id, 'CartSelections', 'data'), state.cartSelections)
            .catch(e => console.warn("CartSelection sync fail", e));
    }
}

export async function loadCartSelections(uid) {
    try {
        const snap = await getDoc(doc(db, 'Users', uid, 'CartSelections', 'data'));
        if (snap.exists()) {
            state.cartSelections = snap.data();
        }
    } catch (e) {
        console.warn("Silent cart selection load fail", e);
    }
}
window.loadCartSelections = loadCartSelections;

// --- Cart System ---

export function saveCart() {
    updateCart(state.cart);
    updateCartUI();

    const totalItems = state.cart.reduce((sum, item) => sum + item.qty, 0);
    if (cartBadge) {
        cartBadge.textContent = totalItems;
        cartBadge.style.display = totalItems > 0 ? 'flex' : 'none';
    }
}
window.saveCart = saveCart;

export async function handleFirebaseCartSync(uid) {
    try {
        const cartSnap = await getDocs(collection(db, 'Users', uid, 'Cart'));
        if (!cartSnap.empty) {
            state.cart = cartSnap.docs.map(doc => doc.data());
            saveCart();
        } else {
            state.cart = [];
            saveCart();
        }
        // Also load cart selections
        await loadCartSelections(uid);
        updateCartUI(); // Re-render with selections
    } catch (e) {
        console.warn("Silent cart hydration failure", e);
    }
}
window.handleFirebaseCartSync = handleFirebaseCartSync;

window.addCartItem = function (productId) {
    const product = state.inventory.find(p => p.id === productId);
    if (!product) return;

    if (product.stock === 0) {
        alert("This item is currently out of stock.");
        return;
    }

    const existingItem = state.cart.find(item => item.id === productId);
    let targetPayload = null;

    if (existingItem) {
        if (existingItem.qty >= product.stock) {
            alert(`Sorry, only ${product.stock} units are available in stock.`);
            return;
        }
        existingItem.qty += 1;
        existingItem.currentPrice = product.offerPrice || product.price;
        targetPayload = existingItem;
    } else {
        const newItem = {
            ...product,
            qty: 1,
            currentPrice: product.offerPrice || product.price
        };
        state.cart.push(newItem);
        targetPayload = newItem;
        // New items default to selected
        state.cartSelections[productId] = true;
    }

    saveCart();
    openCart();

    if (state.currentUser && targetPayload) {
        setDoc(doc(db, 'Users', state.currentUser.id, 'Cart', targetPayload.id), targetPayload).catch(e => console.error("Failsync Cart Add", e));
    }
};

window.updateQty = function (productId, delta) {
    const item = state.cart.find(item => item.id === productId);
    const product = state.inventory.find(p => p.id === productId);
    if (item) {
        if (delta > 0 && product && item.qty + delta > product.stock) {
            alert(`Sorry, only ${product.stock} units are available in stock.`);
            return;
        }
        item.qty += delta;
        if (item.qty <= 0) {
            state.cart = state.cart.filter(x => x.id !== productId);
            delete state.cartSelections[productId];
            if (state.currentUser) {
                deleteDoc(doc(db, 'Users', state.currentUser.id, 'Cart', productId)).catch(e => console.error(e));
            }
        } else {
            if (state.currentUser) {
                updateDoc(doc(db, 'Users', state.currentUser.id, 'Cart', productId), { qty: item.qty }).catch(e => console.error(e));
            }
        }
        saveCart();
    }
};

window.removeFromCart = function (productId) {
    state.cart = state.cart.filter(item => item.id !== productId);
    delete state.cartSelections[productId];
    saveCart();

    if (state.currentUser) {
        deleteDoc(doc(db, 'Users', state.currentUser.id, 'Cart', productId)).catch(e => console.error("Failsync Cart Del", e));
    }
};

export function updateCartUI() {
    // Sync prices from inventory
    state.cart.forEach(cartItem => {
        const invProduct = state.inventory.find(p => p.id === cartItem.id);
        if (invProduct) {
            cartItem.currentPrice = invProduct.offerPrice || invProduct.price;
        }
    });

    const totalItems = state.cart.reduce((sum, item) => sum + item.qty, 0);
    if (cartBadge) {
        cartBadge.textContent = totalItems;
        cartBadge.style.display = totalItems > 0 ? 'flex' : 'none';
    }

    if (!cartItemsContainer) return;

    cartItemsContainer.innerHTML = '';
    if (state.cart.length === 0) {
        cartItemsContainer.innerHTML = '<div class="empty-cart-msg">Your cart is empty. <br> Start exploring our collection! ✨</div>';
        if (cartTotalPrice) cartTotalPrice.textContent = '৳0.00';
        // Hide warning
        const stockWarning = document.getElementById('cart-stock-warning');
        if (stockWarning) stockWarning.style.display = 'none';
        return;
    }

    let totalAmount = 0;
    let hasOutOfStock = false;
    let outOfStockNames = [];

    state.cart.forEach(item => {
        const invProduct = state.inventory.find(p => p.id === item.id);
        const isOutOfStock = invProduct && invProduct.stock === 0;
        const isSelected = !isOutOfStock && isItemSelected(item.id);

        // Auto-deselect out-of-stock items
        if (isOutOfStock) {
            state.cartSelections[item.id] = false;
            hasOutOfStock = true;
            outOfStockNames.push(item.name);
        }

        if (isSelected) {
            totalAmount += item.currentPrice * item.qty;
        }

        const cartItemEl = document.createElement('div');
        cartItemEl.className = 'cart-item';
        cartItemEl.style.cssText = 'position: relative;' + (isOutOfStock ? ' opacity: 0.5;' : '');

        cartItemEl.innerHTML = `
            <div style="display: flex; align-items: center; margin-right: 8px;">
                <input type="checkbox" class="cart-select-cb"
                    data-id="${item.id}"
                    ${isSelected ? 'checked' : ''}
                    ${isOutOfStock ? 'disabled' : ''}
                    style="width: 18px; height: 18px; cursor: ${isOutOfStock ? 'not-allowed' : 'pointer'}; accent-color: var(--primary);">
            </div>
            <img src="${getAbsoluteImageUrl(item.image)}" alt="${item.name}" class="cart-item-img" loading="lazy">
            <div class="cart-item-details">
                <div class="cart-item-title">${item.name}${isOutOfStock ? ' <span style="color: #ff4444; font-size: 0.75rem; font-weight: bold; background: rgba(255,50,50,0.15); padding: 2px 6px; border-radius: 4px; margin-left: 6px;">OUT OF STOCK</span>' : ''}</div>
                <div class="cart-item-price">৳${item.currentPrice.toFixed(2)}</div>
                <div class="cart-item-actions">
                    <div class="qty-control">
                        <button class="qty-btn dec-btn" onclick="window.updateQty('${item.id}', -1)">-</button>
                        <span>${item.qty}</span>
                        <button class="qty-btn inc-btn" onclick="window.updateQty('${item.id}', 1)" ${isOutOfStock ? 'disabled' : ''}>+</button>
                    </div>
                    <button class="remove-btn" onclick="window.removeFromCart('${item.id}')">Remove</button>
                </div>
            </div>
        `;
        cartItemsContainer.appendChild(cartItemEl);
    });

    // Wire up checkbox change handlers
    cartItemsContainer.querySelectorAll('.cart-select-cb').forEach(cb => {
        cb.addEventListener('change', (e) => {
            const itemId = e.target.dataset.id;
            setItemSelected(itemId, e.target.checked);
            updateCartUI(); // Re-render to update totals
        });
    });

    if (cartTotalPrice) cartTotalPrice.textContent = `৳${totalAmount.toFixed(2)}`;

    // Show/hide out-of-stock warning
    const stockWarning = document.getElementById('cart-stock-warning');
    const stockWarningText = document.getElementById('cart-stock-warning-text');
    if (stockWarning) {
        if (hasOutOfStock) {
            stockWarning.style.display = 'block';
            if (stockWarningText) {
                stockWarningText.textContent = outOfStockNames.length === 1
                    ? `"${outOfStockNames[0]}" is out of stock and won't be included in checkout.`
                    : `${outOfStockNames.length} items are out of stock and won't be included in checkout.`;
            }
        } else {
            stockWarning.style.display = 'none';
        }
    }
}

export function openCart() {
    if (cartSidebar) cartSidebar.classList.add('active');
    if (cartOverlay) cartOverlay.classList.add('active');
    document.body.style.overflow = 'hidden';
}
window.openCart = openCart;

export function closeCart() {
    if (cartSidebar) cartSidebar.classList.remove('active');
    if (cartOverlay) cartOverlay.classList.remove('active');
    document.body.style.overflow = '';
}
window.closeCart = closeCart;

// --- Checkout System ---

const DEFAULT_DELIVERY_RULES = {
    'Dhaka City': {
        tiers: [
            { maxItems: 4, charge: 50 },
            { maxItems: 6, charge: 60 },
            { maxItems: 10, charge: 70 }
        ],
        baseChargeOver10: 70,
        extraChargePer10Items: 20
    },
    'Dhaka Sub-Urban': {
        tiers: [
            { maxItems: 10, charge: 100 }
        ],
        baseChargeOver10: 100,
        extraChargePer10Items: 20
    },
    'default': {
        tiers: [
            { maxItems: 5, charge: 110 },
            { maxItems: 10, charge: 130 }
        ],
        baseChargeOver10: 130,
        extraChargePer10Items: 20
    }
};

function calculateDeliveryCharge(district, totalItems) {
    if (totalItems <= 0) return 0;

    const rules = (state.deliveryRules && Object.keys(state.deliveryRules).length > 0)
        ? state.deliveryRules
        : DEFAULT_DELIVERY_RULES;

    let ruleset = rules[district];
    if (!ruleset) {
        ruleset = rules['default'];
    }

    if (!ruleset) return 130;

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

export function openGuestModal() {
    closeCart();
    if (guestModal) guestModal.style.display = 'flex';

    if (Object.keys(state.steadfastLocations).length > 0) {
        const districts = Object.keys(state.steadfastLocations).filter(d => d !== "Dhaka City" && d !== "Dhaka Sub-Urban");
        districts.push("Dhaka");
        districts.sort();

        if (guestDistrict) {
            guestDistrict.innerHTML = '<option value="" disabled selected>Select District</option>';
            districts.forEach(d => {
                const opt = document.createElement('option');
                opt.value = d;
                opt.textContent = d;
                guestDistrict.appendChild(opt);
            });
        }

        if (guestThana) {
            guestThana.innerHTML = '<option value="" disabled selected>Select Thana</option>';
            guestThana.disabled = true;
        }
    }

    if (guestModalLoginLink) {
        const clonedLink = guestModalLoginLink.cloneNode(true);
        guestModalLoginLink.parentNode.replaceChild(clonedLink, guestModalLoginLink);
        clonedLink.addEventListener('click', (e) => {
            e.preventDefault();
            if (guestModal) guestModal.style.display = 'none';
            openAuthModal('login');
        });
    }

    if (guestDistrict) {
        guestDistrict.addEventListener('change', (e) => {
            const selected = e.target.value;
            if (guestThana) {
                guestThana.innerHTML = '<option value="" disabled selected>Select Thana</option>';
                guestThana.disabled = false;
                guestThana.style.background = 'var(--bg-card)';
                guestThana.style.cursor = 'pointer';

                let thanas = [];
                if (selected === "Dhaka") {
                    thanas = [...(state.steadfastLocations["Dhaka City"] || []), ...(state.steadfastLocations["Dhaka Sub-Urban"] || [])];
                } else if (state.steadfastLocations[selected]) {
                    thanas = state.steadfastLocations[selected];
                }

                thanas.sort().forEach(t => {
                    const opt = document.createElement('option');
                    opt.value = t;
                    opt.textContent = t;
                    guestThana.appendChild(opt);
                });
            }
        });
    }

    if (closeGuestModalBtn) {
        closeGuestModalBtn.onclick = () => { if (guestModal) guestModal.style.display = 'none'; };
    }

    if (guestCheckoutForm) {
        guestCheckoutForm.onsubmit = null;
        const newGuestForm = guestCheckoutForm.cloneNode(true);
        guestCheckoutForm.parentNode.replaceChild(newGuestForm, guestCheckoutForm);

        newGuestForm.addEventListener('submit', (e) => {
            e.preventDefault();
            const newGuestNameInput = document.getElementById('guest-name');
            const newGuestMobileInput = document.getElementById('guest-mobile');
            const newGuestAddressInput = document.getElementById('guest-address');
            const newGuestDistrict = document.getElementById('guest-district');
            const newGuestThana = document.getElementById('guest-thana');

            state.currentGuest = {
                name: newGuestNameInput.value.trim(),
                mobile: newGuestMobileInput.value.trim(),
                address: newGuestAddressInput.value.trim(),
                district: newGuestDistrict.value,
                thana: newGuestThana.value
            };

            if (guestModal) guestModal.style.display = 'none';
            openCheckoutView();
        });
    }
}
window.openGuestModal = openGuestModal;

// --- Get selected items for checkout ---
function getSelectedCartItems() {
    return state.cart.filter(item => {
        const invProduct = state.inventory.find(p => p.id === item.id);
        const isOutOfStock = invProduct && invProduct.stock === 0;
        return !isOutOfStock && isItemSelected(item.id);
    });
}

// --- Editable Shipping Details Helper ---
function buildDistrictDropdown(selectedValue) {
    const districts = Object.keys(state.steadfastLocations).filter(d => d !== "Dhaka City" && d !== "Dhaka Sub-Urban");
    districts.push("Dhaka");
    districts.sort();
    let html = '<option value="" disabled>Select District</option>';
    districts.forEach(d => {
        html += `<option value="${d}" ${d === selectedValue ? 'selected' : ''}>${d}</option>`;
    });
    return html;
}

function buildThanaDropdown(district, selectedThana) {
    let thanas = [];
    if (district === "Dhaka") {
        thanas = [...(state.steadfastLocations["Dhaka City"] || []), ...(state.steadfastLocations["Dhaka Sub-Urban"] || [])];
    } else if (state.steadfastLocations[district]) {
        thanas = state.steadfastLocations[district];
    }
    thanas.sort();
    let html = '<option value="" disabled>Select Thana</option>';
    thanas.forEach(t => {
        html += `<option value="${t}" ${t === selectedThana ? 'selected' : ''}>${t}</option>`;
    });
    return html;
}

// Store temporary shipping edit data
let checkoutShippingEdit = null;

export function openCheckoutView() {
    closeCart();
    if (mainLayoutContainer) mainLayoutContainer.style.display = 'none';
    if (checkoutView) checkoutView.style.display = 'block';

    // Set checkout URL
    const activeTarget = state.currentUser || state.currentGuest;
    if (activeTarget) {
        const userId = state.currentUser ? state.currentUser.id : (activeTarget.name || 'guest');
        const checkoutPath = `/${userId}/checkout`;
        let baseUri = '/';
        if (window.location.pathname.startsWith('/toy_and_craft')) baseUri = '/toy_and_craft/';
        try {
            window.history.pushState({ path: baseUri + checkoutPath.replace(/^\//, '') }, '', baseUri + checkoutPath.replace(/^\//, ''));
        } catch (e) {}
    }

    // Reset shipping edit state
    checkoutShippingEdit = null;

    // Render shipping details
    renderShippingDetails();

    // Get only selected items
    const selectedItems = getSelectedCartItems();

    if (checkoutItemsList) {
        checkoutItemsList.innerHTML = '';
        let total = 0;
        selectedItems.forEach(item => {
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
            // Use edited shipping if available, otherwise active target
            const shippingSource = checkoutShippingEdit || state.currentUser || state.currentGuest;
            if (shippingSource && shippingSource.district) {
                if (shippingSource.district === "Dhaka") {
                    currentDistrict = getTrueDistrict(shippingSource.district, shippingSource.thana);
                } else {
                    currentDistrict = shippingSource.district;
                }
            }

            const totalItems = selectedItems.reduce((sum, item) => sum + item.qty, 0);
            const deliveryCharge = calculateDeliveryCharge(currentDistrict, totalItems);
            const grandTotal = total + deliveryCharge;

            if (checkoutSubtotalPrice) checkoutSubtotalPrice.textContent = `৳${total.toFixed(2)}`;
            if (checkoutDeliveryCharge) checkoutDeliveryCharge.textContent = `৳${deliveryCharge.toFixed(2)}`;
            if (checkoutTotalPrice) checkoutTotalPrice.textContent = `৳${grandTotal.toFixed(2)}`;
            if (checkoutConfirmBtn) {
                checkoutConfirmBtn.setAttribute('data-total', grandTotal);
                checkoutConfirmBtn.setAttribute('data-delivery', deliveryCharge);
            }
        };

        recalcCheckoutTotals();
        window.recalcCheckoutTotals = recalcCheckoutTotals;
    }
}
window.openCheckoutView = openCheckoutView;

// --- Shipping Details Rendering ---
function renderShippingDetails() {
    if (!checkoutUserDetails) return;
    const activeTarget = state.currentUser || state.currentGuest;
    if (!activeTarget) return;

    checkoutUserDetails.innerHTML = `
        <p><strong>Name:</strong> ${activeTarget.name}</p>
        <p><strong>Mobile:</strong> ${activeTarget.mobile || 'Not provided'}</p>
        <p><strong>District:</strong> ${activeTarget.district || 'Not provided'}</p>
        <p><strong>Thana:</strong> ${activeTarget.thana || 'Not provided'}</p>
        <p><strong>Delivery Address:</strong><br>${activeTarget.address || 'Not provided'}</p>
        <div style="margin-top: 1rem;">
            <button class="btn btn-secondary btn-sm" id="checkout-edit-shipping-btn" style="display: flex; align-items: center; gap: 4px;">
                <span class="material-icons-round" style="font-size: 16px;">edit</span> Edit
            </button>
        </div>
    `;

    document.getElementById('checkout-edit-shipping-btn')?.addEventListener('click', () => {
        enterShippingEditMode(activeTarget);
    });
}

function enterShippingEditMode(activeTarget) {
    if (!checkoutUserDetails) return;

    const inputStyle = 'width: 100%; border: 1px solid var(--border-color); border-radius: var(--radius-sm); padding: 0.6rem; background: var(--bg-card); color: var(--text-main); font-family: var(--font-body); font-size: 0.9rem;';
    const selectStyle = inputStyle + ' cursor: pointer;';

    checkoutUserDetails.innerHTML = `
        <div style="display: flex; flex-direction: column; gap: 0.8rem;">
            <div>
                <label style="font-weight: 600; font-size: 0.85rem; display: block; margin-bottom: 4px;">Name</label>
                <input type="text" id="ship-edit-name" value="${activeTarget.name || ''}" style="${inputStyle}">
            </div>
            <div>
                <label style="font-weight: 600; font-size: 0.85rem; display: block; margin-bottom: 4px;">Mobile</label>
                <input type="tel" id="ship-edit-mobile" value="${activeTarget.mobile || ''}" style="${inputStyle}">
            </div>
            <div style="display: flex; gap: 0.8rem;">
                <div style="flex: 1;">
                    <label style="font-weight: 600; font-size: 0.85rem; display: block; margin-bottom: 4px;">District</label>
                    <select id="ship-edit-district" style="${selectStyle}">
                        ${buildDistrictDropdown(activeTarget.district || '')}
                    </select>
                </div>
                <div style="flex: 1;">
                    <label style="font-weight: 600; font-size: 0.85rem; display: block; margin-bottom: 4px;">Thana</label>
                    <select id="ship-edit-thana" style="${selectStyle}">
                        ${buildThanaDropdown(activeTarget.district || '', activeTarget.thana || '')}
                    </select>
                </div>
            </div>
            <div>
                <label style="font-weight: 600; font-size: 0.85rem; display: block; margin-bottom: 4px;">Delivery Address</label>
                <textarea id="ship-edit-address" rows="2" style="${inputStyle} resize: vertical;">${activeTarget.address || ''}</textarea>
            </div>
            <div style="display: flex; gap: 0.5rem; flex-wrap: wrap; margin-top: 0.5rem;">
                <button class="btn btn-primary btn-sm" id="ship-save-temp" style="flex: 1;">Save for this order</button>
                ${state.currentUser ? '<button class="btn btn-primary btn-sm" id="ship-save-perm" style="flex: 1; background: #22c55e; border: none;">Save permanently</button>' : ''}
                <button class="btn btn-secondary btn-sm" id="ship-cancel-edit">Cancel</button>
            </div>
        </div>
    `;

    // Wire district → thana cascade
    const districtSelect = document.getElementById('ship-edit-district');
    const thanaSelect = document.getElementById('ship-edit-thana');
    if (districtSelect) {
        districtSelect.addEventListener('change', () => {
            if (thanaSelect) {
                thanaSelect.innerHTML = buildThanaDropdown(districtSelect.value, '');
            }
        });
    }

    // Cancel
    document.getElementById('ship-cancel-edit')?.addEventListener('click', () => {
        checkoutShippingEdit = null;
        renderShippingDetails();
    });

    // Save for this order (temporary)
    document.getElementById('ship-save-temp')?.addEventListener('click', () => {
        const editData = getShippingEditData();
        checkoutShippingEdit = editData;

        // Update guest state if guest
        if (!state.currentUser && state.currentGuest) {
            Object.assign(state.currentGuest, editData);
        }

        renderShippingDetails();
        // Recalc delivery with new district
        if (window.recalcCheckoutTotals) window.recalcCheckoutTotals();
    });

    // Save permanently (logged-in users only)
    document.getElementById('ship-save-perm')?.addEventListener('click', async () => {
        const editData = getShippingEditData();
        checkoutShippingEdit = editData;

        if (state.currentUser) {
            // Update local state
            state.currentUser.name = editData.name;
            state.currentUser.mobile = editData.mobile;
            state.currentUser.district = editData.district;
            state.currentUser.thana = editData.thana;
            state.currentUser.address = editData.address;

            // Save to Firebase
            try {
                await updateDoc(doc(db, 'Users', state.currentUser.id), {
                    name: editData.name,
                    mobile: editData.mobile,
                    district: editData.district,
                    thana: editData.thana,
                    address: editData.address
                });

                // Update local storage
                const storageKey = localStorage.getItem('tc_user') ? 'tc_user' : null;
                const sessionKey = sessionStorage.getItem('tc_user') ? 'tc_user' : null;
                const updatedUser = JSON.stringify(state.currentUser);
                if (storageKey) localStorage.setItem(storageKey, updatedUser);
                if (sessionKey) sessionStorage.setItem(sessionKey, updatedUser);

            } catch (e) {
                console.error("Failed to save shipping permanently", e);
                alert("Failed to save changes. Please try again.");
                return;
            }
        }

        renderShippingDetails();
        if (window.recalcCheckoutTotals) window.recalcCheckoutTotals();
    });
}

function getShippingEditData() {
    return {
        name: document.getElementById('ship-edit-name')?.value.trim() || '',
        mobile: document.getElementById('ship-edit-mobile')?.value.trim() || '',
        district: document.getElementById('ship-edit-district')?.value || '',
        thana: document.getElementById('ship-edit-thana')?.value || '',
        address: document.getElementById('ship-edit-address')?.value.trim() || ''
    };
}

// --- Order Success Modal ---
function showOrderSuccessModal(invoiceId, items, grandTotal) {
    const modal = document.getElementById('order-success-modal');
    const invoiceEl = document.getElementById('order-success-invoice');
    const detailsEl = document.getElementById('order-success-details');
    const continueBtn = document.getElementById('order-success-continue-btn');

    if (!modal) return;

    if (invoiceEl) invoiceEl.textContent = invoiceId;
    if (detailsEl) {
        let html = '';
        items.forEach(item => {
            html += `<div style="display: flex; justify-content: space-between; padding: 4px 0; border-bottom: 1px dotted var(--border-color);">
                <span>${item.name} × ${item.qty}</span>
                <span style="font-weight: 500;">৳${(item.price * item.qty).toFixed(2)}</span>
            </div>`;
        });
        html += `<div style="display: flex; justify-content: space-between; padding: 8px 0 0; font-weight: bold; font-size: 1rem;">
            <span>Grand Total</span>
            <span>৳${grandTotal.toFixed(2)}</span>
        </div>`;
        detailsEl.innerHTML = html;
    }

    modal.style.display = 'flex';

    if (continueBtn) {
        continueBtn.onclick = () => {
            modal.style.display = 'none';
            if (checkoutView) checkoutView.style.display = 'none';
            if (mainLayoutContainer) mainLayoutContainer.style.display = 'block';

            // Navigate to home
            if (state.categories && state.categories.length > 0) {
                state.currentCategorySlug = state.categories[0].slug;
            }
            if (window.updateUrlState) window.updateUrlState(state.currentCategorySlug, 1);
            if (window.renderProducts) window.renderProducts(state.currentCategorySlug, 1);
        };
    }
}

// --- Cart Listeners Setup ---
export function setupCartListeners() {
    if (cartToggleBtn) cartToggleBtn.addEventListener('click', openCart);
    if (closeCartBtn) closeCartBtn.addEventListener('click', closeCart);
    if (cartOverlay) cartOverlay.addEventListener('click', closeCart);

    if (checkoutBtn) {
        checkoutBtn.addEventListener('click', () => {
            if (state.cart.length === 0) {
                alert("Your cart is empty.");
                return;
            }

            const selectedItems = getSelectedCartItems();
            if (selectedItems.length === 0) {
                alert("Please select at least one item to checkout.");
                return;
            }

            if (!state.currentUser) {
                openGuestModal();
            } else {
                openCheckoutView();
            }
        });
    }

    if (checkoutCancelBtn) {
        checkoutCancelBtn.addEventListener('click', () => {
            if (checkoutView) checkoutView.style.display = 'none';
            if (mainLayoutContainer) mainLayoutContainer.style.display = 'block';

            // Navigate back to shop
            if (state.categories && state.categories.length > 0) {
                state.currentCategorySlug = state.categories[0].slug;
            }
            if (window.updateUrlState) window.updateUrlState(state.currentCategorySlug, 1);
        });
    }

    if (checkoutConfirmBtn) {
        checkoutConfirmBtn.addEventListener('click', async () => {
            const selectedItems = getSelectedCartItems();
            if (selectedItems.length === 0) return;

            // --- Stock validation ---
            const stockIssues = [];
            for (const item of selectedItems) {
                const invProduct = state.inventory.find(p => p.id === item.id);
                if (!invProduct || invProduct.stock === 0) {
                    stockIssues.push(`"${item.name}" is out of stock.`);
                } else if (item.qty > invProduct.stock) {
                    stockIssues.push(`"${item.name}" only has ${invProduct.stock} in stock (you have ${item.qty}).`);
                }
            }
            if (stockIssues.length > 0) {
                alert("Stock issues:\n" + stockIssues.join("\n") + "\n\nPlease update your cart.");
                return;
            }

            // Get shipping data (edited or original)
            const shippingSource = checkoutShippingEdit || state.currentUser || state.currentGuest;

            let orderUserId = "guest";
            let orderUsername = "";
            let orderMobile = "";
            let orderAddress = "";
            let orderDistrict = "";
            let orderThana = "";

            if (state.currentUser) {
                orderUserId = state.currentUser.id;
                orderUsername = shippingSource.name || state.currentUser.name || "Unknown User";
                orderMobile = shippingSource.mobile || state.currentUser.mobile || "";
                orderAddress = shippingSource.address || state.currentUser.address || "";
                orderDistrict = shippingSource.district || state.currentUser.district || "Default";
                orderThana = shippingSource.thana || state.currentUser.thana || "Default";
            } else if (state.currentGuest) {
                if (!state.currentGuest.name || !state.currentGuest.mobile ||
                    !state.currentGuest.address || !state.currentGuest.district || !state.currentGuest.thana) {
                    alert("Guest details incomplete. Please restart checkout.");
                    return;
                }
                orderUsername = state.currentGuest.name;
                orderMobile = state.currentGuest.mobile;
                orderAddress = state.currentGuest.address;
                orderDistrict = getTrueDistrict(state.currentGuest.district, state.currentGuest.thana);
                orderThana = state.currentGuest.thana;
            } else {
                alert("Please provide shipping details before confirming.");
                return;
            }

            checkoutConfirmBtn.disabled = true;
            checkoutConfirmBtn.textContent = "Processing...";

            try {
                const payloadItemsQty = selectedItems.reduce((sum, item) => sum + item.qty, 0);
                let currentDistrictCalc = shippingSource?.district || "";
                if (currentDistrictCalc === "Dhaka") {
                    currentDistrictCalc = getTrueDistrict(shippingSource.district, shippingSource.thana);
                }
                const secureDeliveryCharge = calculateDeliveryCharge(currentDistrictCalc, payloadItemsQty);
                const rawSubtotal = selectedItems.reduce((sum, item) => sum + (item.currentPrice * item.qty), 0);
                const secureGrandTotal = rawSubtotal + secureDeliveryCharge;

                const orderPayload = {
                    userId: orderUserId,
                    username: orderUsername,
                    mobile: orderMobile,
                    address: orderAddress,
                    district: orderDistrict,
                    thana: orderThana,
                    items: selectedItems.map(i => ({ id: i.id, name: i.name, price: i.currentPrice, qty: i.qty })),
                    subtotal: rawSubtotal,
                    deliveryCharge: secureDeliveryCharge,
                    totalPrice: secureGrandTotal,
                    status: 'Pending',
                    createdAt: Date.now()
                };

                const counterRef = doc(db, 'Counters', 'InvoiceCounter');
                const secureInvoiceId = await runTransaction(db, async (transaction) => {
                    const counterDoc = await transaction.get(counterRef);
                    let nextInvoice = 2636;
                    if (counterDoc.exists()) {
                        nextInvoice = counterDoc.data().lastInvoice;
                    }
                    nextInvoice += 1;
                    transaction.set(counterRef, { lastInvoice: nextInvoice }, { merge: true });
                    return nextInvoice.toString();
                });

                const newOrderRef = doc(db, 'Orders', secureInvoiceId);
                orderPayload.id = secureInvoiceId;

                const batch = writeBatch(db);
                batch.set(newOrderRef, orderPayload);

                if (state.currentUser) {
                    const userOrderRef = doc(db, 'Users', state.currentUser.id, 'Orders', secureInvoiceId);
                    batch.set(userOrderRef, orderPayload);
                }

                // Update product stock counts
                selectedItems.forEach(item => {
                    const newStock = Math.max(0, (item.stock || 1) - item.qty);
                    if (item.categoryId) {
                        const prodRef = doc(db, 'Products', item.categoryId, 'Items', item.id);
                        batch.update(prodRef, { stock: newStock });
                    }
                });

                await batch.commit();

                // Update local memory inventory array
                selectedItems.forEach(item => {
                    const invProd = state.inventory.find(p => p.id === item.id);
                    if (invProd) {
                        invProd.stock = Math.max(0, (invProd.stock || 1) - item.qty);
                    }
                });

                // Show success modal
                showOrderSuccessModal(secureInvoiceId, orderPayload.items, secureGrandTotal);

                // Clear checked-out items from cart
                if (state.currentUser) {
                    const wipeBatch = writeBatch(db);
                    selectedItems.forEach(item => {
                        wipeBatch.delete(doc(db, 'Users', state.currentUser.id, 'Cart', item.id));
                    });
                    await wipeBatch.commit().catch(e => console.error("Silent Cart Wipe Failure", e));
                }

                // Remove only the selected items from cart (keep unselected ones)
                const selectedIds = new Set(selectedItems.map(i => i.id));
                state.cart = state.cart.filter(item => !selectedIds.has(item.id));
                // Clean up selections for removed items
                selectedIds.forEach(id => delete state.cartSelections[id]);
                saveCart();

                // Reset shipping edit
                checkoutShippingEdit = null;

            } catch (err) {
                console.error("Order Failed:", err);
                alert("Error communicating with the database during checkout.");
            }

            checkoutConfirmBtn.disabled = false;
            checkoutConfirmBtn.textContent = "Confirm Order";
        });
    }
}
