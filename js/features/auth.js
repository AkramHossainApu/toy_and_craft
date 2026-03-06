import { state, updateCart, setAdmin } from '../core/state.js';
import { db, doc, getDoc, setDoc, updateDoc, collection, query, where, getDocs } from '../config/firebase.js';
import {
    authLoginBtn, userProfileBadge, cartToggleBtn, adminNavbarLogoutBtn, userProfileName,
    loginForm, registerForm, profileForm, authModalTitle, loginView, registerView, profileView,
    profileUsernameInput, profileUseridInput, profileMobileInput, profileAddressInput, profileDistrictInput, profileThanaInput,
    authModal, showRegisterBtn, showLoginBtn, authLogoutBtn, loginIdentifierInput, loginPasswordInput, loginRememberInput, loginSubmitBtn,
    registerUsernameInput, registerUseridInput, registerMobileInput, registerPasswordInput, registerAddressInput, registerDistrictInput, registerThanaInput, registerRememberInput, registerSubmitBtn,
    profileUpdateBtn, closeAuthModalBtn, profileOrdersList
} from '../core/dom.js';
import { generateSlug } from '../core/utils.js';

// --- User Authentication & Profile Logic ---

export function updateAuthUI() {
    // If admin is active, strictly hide the login button no matter what
    if (state.isAdmin) {
        if (authLoginBtn) authLoginBtn.style.display = 'none';
        if (userProfileBadge) userProfileBadge.style.display = 'none';
        if (cartToggleBtn) cartToggleBtn.style.display = 'none';
        if (adminNavbarLogoutBtn) adminNavbarLogoutBtn.style.display = 'block';
        return;
    }

    // Reset standard generic views if not admin
    if (cartToggleBtn) cartToggleBtn.style.display = 'flex';
    if (adminNavbarLogoutBtn) adminNavbarLogoutBtn.style.display = 'none';

    if (state.currentUser) {
        if (authLoginBtn) authLoginBtn.style.display = 'none';
        if (userProfileBadge) {
            userProfileBadge.style.display = 'flex';
            userProfileName.textContent = state.currentUser.name || state.currentUser.id;
        }
    } else {
        if (authLoginBtn) authLoginBtn.style.display = 'block';
        if (userProfileBadge) userProfileBadge.style.display = 'none';
        // Enforce path fallback if session expires or logs out, preserving current view
        if (state.routingInitialized && state.categories.length > 0) {
            if (window.currentViewedProduct && window.shopSection && window.shopSection.style.display === 'none') {
                window.updateUrlState(state.currentCategorySlug, state.currentPage, window.currentViewedProduct.slug);
            } else if (window.updateUrlState) {
                window.updateUrlState(state.currentCategorySlug, state.currentPage);
            }
        }
    }
}

export function initLocationDropdowns() {
    console.log("AUTH.JS: initLocationDropdowns triggered. Locations count:", Object.keys(state.steadfastLocations).length);
    if (Object.keys(state.steadfastLocations).length === 0) {
        console.warn("AUTH.JS: Aborting dropdown init because SteadfastLocations is empty.");
        return;
    }

    const districts = Object.keys(state.steadfastLocations).filter(d => d !== "Dhaka City" && d !== "Dhaka Sub-Urban");
    districts.push("Dhaka");
    districts.sort();

    const populateDistrict = (selectEl) => {
        if (!selectEl) return;
        // Preserve empty first option
        selectEl.innerHTML = '<option value="" disabled selected>Select District</option>';
        districts.forEach(d => {
            const opt = document.createElement('option');
            opt.value = d;
            opt.textContent = d;
            selectEl.appendChild(opt);
        });
    };

    populateDistrict(registerDistrictInput);
    populateDistrict(profileDistrictInput);

    const handleDistrictChange = (thanaSelectEl) => (e) => {
        if (!thanaSelectEl) return;
        const selected = e.target.value;
        thanaSelectEl.innerHTML = '<option value="" disabled selected>Select Thana</option>';
        thanaSelectEl.disabled = false;
        thanaSelectEl.style.background = 'var(--bg-card)';
        thanaSelectEl.style.cursor = 'pointer';

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
            thanaSelectEl.appendChild(opt);
        });
    };

    if (registerDistrictInput && registerThanaInput) {
        registerDistrictInput.addEventListener('change', handleDistrictChange(registerThanaInput));
    }
    if (profileDistrictInput && profileThanaInput) {
        profileDistrictInput.addEventListener('change', handleDistrictChange(profileThanaInput));
    }
}
window.initLocationDropdowns = initLocationDropdowns;

export function openAuthModal(view = 'login') {
    if (loginForm) loginForm.reset();
    if (registerForm) registerForm.reset();
    if (profileForm) profileForm.reset();

    if (state.currentUser) {
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
                if (window.updateUrlState) window.updateUrlState('Details'); // Optional pathing
            };

            tabOrders.onclick = () => {
                tabOrders.style.borderBottomColor = 'var(--primary)';
                tabOrders.style.color = 'var(--primary)';
                tabDetails.style.borderBottomColor = 'transparent';
                tabDetails.style.color = 'var(--text-muted)';
                contentDetails.style.display = 'none';
                contentOrders.style.display = 'block';
                if (window.loadProfileOrders) window.loadProfileOrders();
                if (window.updateUrlState) window.updateUrlState('Orders'); // Required pathing -> /{UserID}/Orders
            };

            // Force Details visible by default
            tabDetails.click();
        }

        if (profileUsernameInput) profileUsernameInput.value = state.currentUser.name || '';
        if (profileUseridInput) profileUseridInput.value = state.currentUser.id;
        if (profileMobileInput) profileMobileInput.value = state.currentUser.mobile || '';
        if (profileAddressInput) profileAddressInput.value = state.currentUser.address || '';

        if (profileDistrictInput && state.currentUser.district) {
            let mappedDistrict = state.currentUser.district;
            if (mappedDistrict === "Dhaka City" || mappedDistrict === "Dhaka Sub-Urban") {
                mappedDistrict = "Dhaka";
            }
            profileDistrictInput.value = mappedDistrict;

            profileDistrictInput.dispatchEvent(new Event('change'));

            if (profileThanaInput && state.currentUser.thana) {
                profileThanaInput.value = state.currentUser.thana;
            }
        }

        if (window.loadProfileOrders) window.loadProfileOrders();
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
        if (window.updateUrlState) window.updateUrlState(view); // Instantly update URL to /login or /register
    }

    if (authModal) authModal.style.display = 'flex';
}
window.openAuthModal = openAuthModal;

export const closeAuthModal = () => {
    if (authModal) authModal.style.display = 'none';
    if (state.currentCategorySlug && window.updateUrlState) window.updateUrlState(state.currentCategorySlug); // Revert to active category
};

export function setupAuthListeners() {
    if (authLoginBtn) authLoginBtn.addEventListener('click', () => openAuthModal('login'));
    if (userProfileBadge) userProfileBadge.addEventListener('click', () => openAuthModal());
    if (closeAuthModalBtn) closeAuthModalBtn.addEventListener('click', closeAuthModal);

    if (showRegisterBtn) showRegisterBtn.addEventListener('click', (e) => { e.preventDefault(); openAuthModal('register'); });
    if (showLoginBtn) showLoginBtn.addEventListener('click', (e) => { e.preventDefault(); openAuthModal('login'); });

    if (authLogoutBtn) {
        authLogoutBtn.addEventListener('click', () => {
            state.currentUser = null;
            localStorage.removeItem('tc_user');
            sessionStorage.removeItem('tc_user');

            // Wipe local cart on explicit sign out
            updateCart([]);

            updateAuthUI();
            closeAuthModal();

            // Bounce to root category visually
            if (state.categories.length > 0) {
                state.currentCategorySlug = state.categories[0].slug;
                if (window.updateUrlState) window.updateUrlState(state.currentCategorySlug);
                if (window.renderCategoryTabs) window.renderCategoryTabs();
                if (window.renderProducts) window.renderProducts(state.currentCategorySlug, 1);
            }
        });
    }

    // UserID Auto-generation logic (Debounced)
    let debounceTimer;
    if (registerUsernameInput) {
        registerUsernameInput.addEventListener('input', () => {
            clearTimeout(debounceTimer);
            const username = registerUsernameInput.value.trim();
            const baseId = generateSlug(username);

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
                let userSnap = await getDoc(doc(db, 'Users', identifier));
                if (!userSnap.exists()) {
                    const qUser = query(collection(db, 'Users'), where('username', '==', identifier));
                    const qsUser = await getDocs(qUser);
                    if (!qsUser.empty) {
                        userSnap = qsUser.docs[0];
                    } else {
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
                        state.currentUser = {
                            id: userSnap.id,
                            name: data.username || '',
                            mobile: data.mobile || '',
                            address: data.address || ''
                        };

                        if (remember) {
                            localStorage.setItem('tc_user', JSON.stringify(state.currentUser));
                        } else {
                            sessionStorage.setItem('tc_user', JSON.stringify(state.currentUser));
                        }

                        if (window.handleFirebaseCartSync) await window.handleFirebaseCartSync(state.currentUser.id);

                        updateAuthUI();
                        closeAuthModal();

                        if (state.currentCategorySlug && window.updateUrlState) {
                            window.updateUrlState(state.currentCategorySlug);
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
                    let finalDistrict = rawDistrict;
                    if (window.getTrueDistrict) finalDistrict = window.getTrueDistrict(rawDistrict, rawThana);

                    await setDoc(userRef, {
                        username: username,
                        mobile: mobile,
                        password: password,
                        address: address,
                        district: finalDistrict,
                        thana: rawThana,
                        createdAt: Date.now()
                    });

                    state.currentUser = { id: userid, name: username, mobile: mobile, address: address, district: finalDistrict, thana: rawThana };
                    if (remember) {
                        localStorage.setItem('tc_user', JSON.stringify(state.currentUser));
                    } else {
                        sessionStorage.setItem('tc_user', JSON.stringify(state.currentUser));
                    }

                    updateCart([]);

                    updateAuthUI();
                    closeAuthModal();

                    if (state.currentCategorySlug && window.updateUrlState) {
                        window.updateUrlState(state.currentCategorySlug);
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

            if (!state.currentUser) return;
            if (!rawDistrict || !rawThana) {
                alert("Please accurately select both a District and a Thana before saving.");
                return;
            }

            profileUpdateBtn.disabled = true;
            profileUpdateBtn.textContent = "Updating...";

            try {
                let finalDistrict = rawDistrict;
                if (window.getTrueDistrict) finalDistrict = window.getTrueDistrict(rawDistrict, rawThana);
                await updateDoc(doc(db, 'Users', state.currentUser.id), {
                    address: newAddress,
                    mobile: newMobile,
                    district: finalDistrict,
                    thana: rawThana
                });
                state.currentUser.address = newAddress;
                state.currentUser.mobile = newMobile;
                state.currentUser.district = finalDistrict;
                state.currentUser.thana = rawThana;

                if (localStorage.getItem('tc_user')) {
                    localStorage.setItem('tc_user', JSON.stringify(state.currentUser));
                } else {
                    sessionStorage.setItem('tc_user', JSON.stringify(state.currentUser));
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
}

// --- Profile Order Loader ---
export async function loadProfileOrders() {
    if (!profileOrdersList || !state.currentUser) return;
    profileOrdersList.innerHTML = '<div style="color: var(--text-muted); font-size: 0.9rem;">Loading orders...</div>';

    try {
        const q = query(collection(db, 'Orders'), where('userId', '==', state.currentUser.id));
        const snapshots = await getDocs(q);

        profileOrdersList.innerHTML = '';
        if (snapshots.empty) {
            profileOrdersList.innerHTML = '<div style="color: var(--text-muted); font-size: 0.9rem;">No past orders found.</div>';
            return;
        }

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
window.loadProfileOrders = loadProfileOrders;
