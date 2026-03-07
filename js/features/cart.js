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
    saveCart();

    if (state.currentUser) {
        deleteDoc(doc(db, 'Users', state.currentUser.id, 'Cart', productId)).catch(e => console.error("Failsync Cart Del", e));
    }
};

export function updateCartUI() {
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
        return;
    }

    let totalAmount = 0;
    state.cart.forEach(item => {
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

    // Use Firebase rules if available, otherwise use hardcoded defaults
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

export function openCheckoutView() {
    closeCart();
    if (mainLayoutContainer) mainLayoutContainer.style.display = 'none';
    if (checkoutView) checkoutView.style.display = 'block';

    if (window.updateUrlState) window.updateUrlState('Checkout...');

    let currentUserId = state.currentUser ? state.currentUser.id : "guest";
    getDoc(doc(db, 'Counters', 'InvoiceCounter')).then(docSnap => {
        let proposed = 2637;
        if (docSnap.exists()) {
            proposed = docSnap.data().lastInvoice + 1;
        }
        try {
            const draftPath = `/${currentUserId}/${proposed}`;
            let baseUri = '/';
            if (window.location.pathname.startsWith('/toy_and_craft')) {
                baseUri = '/toy_and_craft/';
            }
            window.history.pushState({ path: baseUri + draftPath.replace(/^\//, '') }, '', baseUri + draftPath.replace(/^\//, ''));
        } catch (e) { }
    }).catch(err => console.log("Silent error reading counter predict", err));

    if (checkoutUserDetails) {
        const activeTarget = state.currentUser || state.currentGuest;
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

    if (checkoutItemsList) {
        checkoutItemsList.innerHTML = '';
        let total = 0;
        state.cart.forEach(item => {
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
            const activeTarget = state.currentUser || state.currentGuest;
            if (activeTarget && activeTarget.district) {
                if (activeTarget.district === "Dhaka") {
                    currentDistrict = getTrueDistrict(activeTarget.district, activeTarget.thana);
                } else {
                    currentDistrict = activeTarget.district;
                }
            }

            const totalItems = state.cart.reduce((sum, item) => sum + item.qty, 0);
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
        });
    }

    if (checkoutConfirmBtn) {
        checkoutConfirmBtn.addEventListener('click', async () => {
            if (state.cart.length === 0) return;

            let orderUserId = "guest";
            let orderUsername = "";
            let orderMobile = "";
            let orderAddress = "";
            let orderDistrict = "";
            let orderThana = "";

            if (state.currentUser) {
                orderUserId = state.currentUser.id;
                orderUsername = state.currentUser.name || "Unknown User";
                orderMobile = state.currentUser.mobile || "";
                orderAddress = state.currentUser.address || "";
                orderDistrict = state.currentUser.district || "Default";
                orderThana = state.currentUser.thana || "Default";
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
                const payloadItemsQty = state.cart.reduce((sum, item) => sum + item.qty, 0);
                const activeTarget = state.currentUser || state.currentGuest || {};
                let currentDistrictCalc = activeTarget.district || "";
                if (currentDistrictCalc === "Dhaka") {
                    currentDistrictCalc = getTrueDistrict(activeTarget.district, activeTarget.thana);
                }
                const secureDeliveryCharge = calculateDeliveryCharge(currentDistrictCalc, payloadItemsQty);
                const rawSubtotal = state.cart.reduce((sum, item) => sum + (item.currentPrice * item.qty), 0);
                const secureGrandTotal = rawSubtotal + secureDeliveryCharge;

                const orderPayload = {
                    userId: orderUserId,
                    username: orderUsername,
                    mobile: orderMobile,
                    address: orderAddress,
                    district: orderDistrict,
                    thana: orderThana,
                    items: state.cart.map(i => ({ id: i.id, name: i.name, price: i.currentPrice, qty: i.qty })),
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

                await batch.commit();

                alert("Order Confirmed! Your Invoice Number is: " + secureInvoiceId);

                if (state.currentUser) {
                    const wipeBatch = writeBatch(db);
                    state.cart.forEach(item => {
                        wipeBatch.delete(doc(db, 'Users', state.currentUser.id, 'Cart', item.id));
                    });
                    await wipeBatch.commit().catch(e => console.error("Silent Cart Wipe Failure", e));
                }

                state.cart = [];
                saveCart();

                if (checkoutView) checkoutView.style.display = 'none';
                if (mainLayoutContainer) mainLayoutContainer.style.display = 'block';

            } catch (err) {
                console.error("Order Failed:", err);
                alert("Error communicating with the database during checkout.");
            }

            checkoutConfirmBtn.disabled = false;
            checkoutConfirmBtn.textContent = "Confirm Order";
        });
    }
}
