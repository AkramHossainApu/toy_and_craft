import { state, setAdmin } from '../core/state.js';
import { db, doc, getDoc, setDoc, deleteDoc, getDocs, collection, writeBatch } from '../config/firebase.js';
import { generateSlug } from '../core/utils.js';
import {
    adminToolsBanner, adminHeaderEditContainer, siteTitle, adminNavbarLogoutBtn,
    passwordModal, passwordModalTitle, passwordInput, passwordSubmitBtn, passwordCancelBtn,
    adminEditHeaderBtn, adminHeaderTitleInput, adminHeaderSubtitleInput, headerModal, closeHeaderModalBtn, headerCancelBtn, adminHeaderForm, homeTitle, homeSubtitle,
    categoryModal, closeCategoryModalBtn, categoryCancelBtn, categoryForm, newCategoryNameInput,
    adminModal, closeAdminModal, adminCancelBtn, adminProductForm, adminModalTitle, adminProductId, adminProductName, adminProductCategory, adminProductPrice, adminProductOffer,
    adminProductNew, adminProductSale, categoryTabsContainer
} from '../core/dom.js';

import { updateAuthUI } from './auth.js';
import { uploadImageToDrive, isDriveAuthorized, getDriveAccessToken, handleDriveAuthRedirect, renameDriveFile } from './drive.js';
import { syncDriveImages } from './sync.js';

// Handle Drive OAuth redirect (runs on page load)
handleDriveAuthRedirect();


// --- Admin Authentication & Triggers ---
export function toggleAdminMode(isAdminState) {
    setAdmin(isAdminState);

    if (state.isAdmin) {
        // Log out normal user if they were mistakenly logged in while activating Admin
        if (state.currentUser) {
            state.currentUser = null;
            localStorage.removeItem('tc_user');
            sessionStorage.removeItem('tc_user');
            updateAuthUI();
        }
        if (adminToolsBanner) adminToolsBanner.style.display = 'flex';
        if (adminHeaderEditContainer) adminHeaderEditContainer.style.display = 'block';

        // Force admin to base product grid view
        if (state.categories && state.categories.length > 0) {
            state.currentCategorySlug = state.categories[0].slug;
        }
        if (window.updateUrlState) window.updateUrlState('admin');
        const productViewSection = document.getElementById('product-view');
        if (productViewSection) productViewSection.style.display = 'none';
        const shopSection = document.getElementById('shop');
        if (shopSection) shopSection.style.display = 'block';

    } else {
        if (adminToolsBanner) adminToolsBanner.style.display = 'none';
        if (adminHeaderEditContainer) adminHeaderEditContainer.style.display = 'none';

        if (state.categories && state.categories.length > 0) {
            state.currentCategorySlug = state.categories[0].slug;
            if (window.updateUrlState) window.updateUrlState(state.currentCategorySlug);
        }
    }

    if (window.renderCategoryTabs) window.renderCategoryTabs();
    if (window.renderProducts) window.renderProducts(state.currentCategorySlug);
    updateAuthUI();
}

let holdTimer = null;
export function setupAdminListeners() {
    // Secret Admin Login Trigger (Hold 'Toy & Craft' logic for 2 seconds)
    if (siteTitle) {
        const startHold = (e) => {
            if (e.type === 'mousedown' && e.button !== 0) return;

            holdTimer = setTimeout(() => {
                if (!state.isAdmin) {
                    if (state.routingInitialized && window.updateUrlState) window.updateUrlState('authenticate-admin');
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
            if (state.routingInitialized && state.categories && state.categories.length > 0) {
                state.currentCategorySlug = state.categories[0].slug;
                if (window.updateUrlState) window.updateUrlState(state.currentCategorySlug);
                if (window.renderCategoryTabs) window.renderCategoryTabs();
                if (window.renderProducts) window.renderProducts(state.currentCategorySlug);
                if (window.closeCart) window.closeCart();
            }
        });
    }

    // Add duplicate home-button functionality directly to the physical image logo too
    const siteLogoImg = document.querySelector('.site-logo-img');
    if (siteLogoImg) {
        siteLogoImg.style.cursor = 'pointer';
        siteLogoImg.addEventListener('click', (e) => {
            if (state.routingInitialized && state.categories && state.categories.length > 0) {
                state.currentCategorySlug = state.categories[0].slug;
                if (window.updateUrlState) window.updateUrlState(state.currentCategorySlug);
                if (window.renderCategoryTabs) window.renderCategoryTabs();
                if (window.renderProducts) window.renderProducts(state.currentCategorySlug);
                if (window.closeCart) window.closeCart();
            }
        });
    }

    if (adminNavbarLogoutBtn) {
        adminNavbarLogoutBtn.addEventListener('click', () => toggleAdminMode(false));
    }

    // --- Custom Password Modal Local Listeners ---
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

    // --- Category Creation (Firebase) ---
    const closeCategoryModalFn = () => { if (categoryModal) categoryModal.style.display = 'none'; };
    if (closeCategoryModalBtn) closeCategoryModalBtn.addEventListener('click', closeCategoryModalFn);
    if (categoryCancelBtn) categoryCancelBtn.addEventListener('click', closeCategoryModalFn);

    if (categoryForm) {
        categoryForm.addEventListener('submit', async (e) => {
            e.preventDefault();
            const newCatName = newCategoryNameInput.value.trim();
            if (!newCatName) return;

            try {
                let newOrder = 0;
                if (state.categories.length > 0) {
                    newOrder = Math.max(...state.categories.map(c => c.order || 0)) + 1;
                }
                await setDoc(doc(db, 'Products', newCatName), { createdAt: Date.now(), order: newOrder }, { merge: true });
                state.currentCategorySlug = generateSlug(newCatName);
                closeCategoryModalFn();
            } catch (err) {
                console.error("Error creating category:", err);
                alert("Failed to create category on the database.");
            }
        });
    }

    // --- Product Edit View Attachments ---
    const closeAdminModalFn = () => { if (adminModal) adminModal.style.display = 'none'; };
    if (closeAdminModal) closeAdminModal.addEventListener('click', closeAdminModalFn);
    if (adminCancelBtn) adminCancelBtn.addEventListener('click', closeAdminModalFn);

    if (adminProductForm) {
        // ── Drive file picker: upload images on selection ──
        const fileInput = document.getElementById('admin-product-file-input');
        const statusDiv = document.getElementById('drive-upload-status');
        const previewDiv = document.getElementById('admin-image-previews');
        const imageTextarea = document.getElementById('admin-product-image');
        const driveAuthNotice = document.getElementById('drive-auth-notice');
        const driveConnectBtn = document.getElementById('drive-connect-btn');

        // Show Drive auth notice if not connected
        const checkDriveAuth = () => {
            if (driveAuthNotice) {
                driveAuthNotice.style.display = isDriveAuthorized() ? 'none' : 'block';
            }
        };
        checkDriveAuth();

        if (driveConnectBtn) {
            driveConnectBtn.addEventListener('click', async () => {
                driveConnectBtn.textContent = 'Connecting...';
                driveConnectBtn.disabled = true;
                try {
                    await getDriveAccessToken();
                    checkDriveAuth();
                } catch (e) {
                    alert('Drive connection failed: ' + e.message);
                    driveConnectBtn.textContent = 'Connect Drive';
                    driveConnectBtn.disabled = false;
                }
            });
        }

        // Track pending uploads promise
        let pendingUploadPromise = null;

        if (fileInput) {
            fileInput.addEventListener('change', async () => {
                const files = Array.from(fileInput.files);
                if (!files.length) return;

                const catSlug = adminProductCategory.value || 'products';
                if (statusDiv) statusDiv.innerHTML = '';
                if (previewDiv) previewDiv.innerHTML = '';

                // Get current URLs from textarea
                const existingUrls = imageTextarea ? imageTextarea.value.split(',').map(s => s.trim()).filter(Boolean) : [];
                const allUrls = [...existingUrls];

                const uploadItems = files.map(file => {
                    const row = document.createElement('div');
                    row.style.cssText = 'display:flex;align-items:center;gap:0.4rem;font-size:0.82rem;margin:0.2rem 0;';
                    row.innerHTML = `<span class="material-icons-round" style="font-size:16px;animation:spin 1s linear infinite;">sync</span> <span>${file.name}</span>`;
                    if (statusDiv) statusDiv.appendChild(row);
                    return { file, row };
                });

                pendingUploadPromise = (async () => {
                    const baseName = adminProductName.value.trim() || 'product';
                    const safeBaseName = baseName.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/(^-|-$)/g, '');

                    for (let i = 0; i < uploadItems.length; i++) {
                        const { file, row } = uploadItems[i];
                        try {
                            const ext = file.name.split('.').pop();
                            const index = allUrls.length + 1;
                            const customFileName = `${safeBaseName}-${index}.${ext}`;

                            const url = await uploadImageToDrive(file, catSlug, customFileName);
                            allUrls.push(url);
                            row.innerHTML = `<span class="material-icons-round" style="font-size:16px;color:#22c55e;">check_circle</span> <span>${file.name}</span>`;

                            // Show preview
                            if (previewDiv) {
                                const img = document.createElement('img');
                                img.src = url;
                                img.style.cssText = 'width:64px;height:64px;object-fit:cover;border-radius:8px;border:1px solid var(--border-color);';
                                previewDiv.appendChild(img);
                            }
                        } catch (err) {
                            row.innerHTML = `<span class="material-icons-round" style="font-size:16px;color:#ef4444;">error</span> <span>${file.name}: ${err.message}</span>`;
                        }
                    }
                    // Sync to hidden textarea
                    if (imageTextarea) imageTextarea.value = allUrls.join(', ');
                })();
            });
        }

        adminProductForm.addEventListener('submit', async (e) => {
            e.preventDefault();

            // Wait for any in-progress uploads
            if (pendingUploadPromise) {
                const submitBtn = adminProductForm.querySelector('[type="submit"]');
                if (submitBtn) { submitBtn.disabled = true; submitBtn.textContent = 'Uploading...'; }
                try { await pendingUploadPromise; } catch { }
                if (submitBtn) { submitBtn.disabled = false; submitBtn.textContent = 'Save Product'; }
                pendingUploadPromise = null;
            }

            const offerVal = parseFloat(adminProductOffer.value);
            const adminProductImageEl = document.getElementById('admin-product-image');
            const adminProductDesc = document.getElementById('admin-product-description');
            const imagesRaw = adminProductImageEl ? adminProductImageEl.value.split(',').map(s => s.trim()).filter(Boolean) : [];
            const mainImage = imagesRaw.length > 0 ? imagesRaw[0] : '';
            const adminProductStock = document.getElementById('admin-product-stock');

            const targetCatId = adminProductCategory.value;
            const productId = adminProductId.value; // May be empty for new products

            const productNameTrimmed = adminProductName.value.trim();
            const safeBaseName = productNameTrimmed.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/(^-|-$)/g, '');

            // Check if name changed && rename existing drive files
            if (productId) {
                const existingProd = state.inventory.find(p => p.id === productId);
                if (existingProd && existingProd.name !== productNameTrimmed && imagesRaw.length > 0) {
                    // Name changed! Rename files in Drive
                    const submitBtn = adminProductForm.querySelector('[type="submit"]');
                    if (submitBtn) submitBtn.textContent = 'Renaming images...';

                    for (let i = 0; i < imagesRaw.length; i++) {
                        const url = imagesRaw[i];
                        if (url.includes('drive.google.com')) {
                            // Extract extension from old URL if possible, default to jpg
                            let ext = 'jpg';
                            // We don't have the real extension in the thumbnail URL easily, 
                            // but we can just use .jpg for the drive filename as it's display-only
                            const newFileName = `${safeBaseName}-${i + 1}.${ext}`;
                            await renameDriveFile(url, newFileName);
                        }
                    }
                    if (submitBtn) submitBtn.textContent = 'Save Product';
                }
            }

            const productData = {
                name: productNameTrimmed,
                slug: generateSlug(productNameTrimmed),
                description: adminProductDesc ? adminProductDesc.value.trim() : '',
                images: imagesRaw,
                price: parseFloat(adminProductPrice.value),
                offerPrice: isNaN(offerVal) ? null : offerVal,
                image: mainImage,
                isNew: adminProductNew.checked,
                isSale: adminProductSale.checked,
                stock: adminProductStock && adminProductStock.value ? parseInt(adminProductStock.value) : 10,
                updatedAt: Date.now()
            };

            try {
                let targetRef;
                if (productId) {
                    // Update existing
                    targetRef = doc(db, 'Products', targetCatId, 'Items', productId);
                    const originalCatId = adminProductId.getAttribute('data-original-cat');

                    if (originalCatId && originalCatId !== targetCatId) {
                        // Category changed, delete old document first
                        await deleteDoc(doc(db, 'Products', originalCatId, 'Items', productId));
                    }
                } else {
                    // Create new
                    const itemsCollectionRef = collection(db, 'Products', targetCatId, 'Items');
                    targetRef = doc(itemsCollectionRef);
                    // Explicitly inject the newly generated ID into the document body to match the user's DB schema
                    productData.id = targetRef.id;
                }

                await setDoc(targetRef, productData, { merge: true });

                // Keep the UI in sync physically in State
                let existingProd = state.inventory.find(p => p.id === productId);
                if (existingProd) {
                    Object.assign(existingProd, productData);
                    existingProd.categoryId = targetCatId; // In case it moved
                    existingProd.categorySlug = generateSlug(targetCatId);
                } else {
                    // new product
                    state.inventory.push({
                        ...productData,
                        id: productData.id,
                        categoryId: targetCatId,
                        categorySlug: generateSlug(targetCatId)
                    });
                }

                // Show success feedback on the button, then close modal after delay
                const btn = adminProductForm.querySelector('button[type="submit"]');
                if (btn) {
                    const oldText = btn.textContent;
                    btn.textContent = "Saved to Database!";
                    btn.style.backgroundColor = '#00c853';
                    btn.style.color = '#fff';
                    setTimeout(() => {
                        btn.textContent = oldText;
                        btn.style.backgroundColor = '';
                        btn.style.color = '';
                        // Close modal and re-render after feedback is shown
                        state.currentCategorySlug = generateSlug(targetCatId);
                        closeAdminModalFn();
                        if (window.renderProducts) window.renderProducts(state.currentCategorySlug);
                    }, 1500);
                } else {
                    // Fallback if button not found — close immediately
                    state.currentCategorySlug = generateSlug(targetCatId);
                    closeAdminModalFn();
                    if (window.renderProducts) window.renderProducts(state.currentCategorySlug);
                }

            } catch (err) {
                console.error("DIAGNOSTIC ERROR:", err.message || err);
                alert("Database Error! Message: " + (err.message || JSON.stringify(err)));
            }
        });
    }

    // Attach to Window since these are invoked from HTML directly
    window.openEditModal = function (productId = null) {
        if (adminProductCategory) adminProductCategory.innerHTML = '';
        state.categories.forEach(cat => {
            const opt = document.createElement('option');
            opt.value = cat.id; // DB ID (e.g. "Mini Bricks")
            opt.textContent = cat.id;
            if (adminProductCategory) adminProductCategory.appendChild(opt);
        });

        if (productId) {
            const product = state.inventory.find(p => p.id === productId);
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

            // Handle image cover UI and previews
            const editPreviewDiv = document.getElementById('admin-image-previews');
            const editStatusDiv = document.getElementById('drive-upload-status');
            const coverSection = document.getElementById('admin-cover-image-section');
            const coverImage = document.getElementById('admin-cover-image');
            const uploadArea = document.getElementById('drive-upload-area');
            const existingUrls = adminProductImageEl ? adminProductImageEl.value.split(',').map(s => s.trim()).filter(Boolean) : [];

            if (editPreviewDiv) {
                editPreviewDiv.innerHTML = '';
                existingUrls.forEach(url => {
                    const img = document.createElement('img');
                    img.src = url;
                    img.style.cssText = 'width:64px;height:64px;object-fit:cover;border-radius:8px;border:1px solid var(--border-color);';
                    editPreviewDiv.appendChild(img);
                });
            }
            if (editStatusDiv) editStatusDiv.innerHTML = '';

            // Toggle cover image layout
            if (existingUrls.length > 0) {
                if (coverSection) coverSection.style.display = 'block';
                if (coverImage) coverImage.src = existingUrls[0];
                if (uploadArea) uploadArea.style.display = 'none';
            } else {
                if (coverSection) coverSection.style.display = 'none';
                if (uploadArea) uploadArea.style.display = 'flex';
            }

            if (adminProductDesc) adminProductDesc.value = product.description || '';
            const adminProductStock = document.getElementById('admin-product-stock');
            if (adminProductStock && product.stock !== undefined) adminProductStock.value = product.stock;
            if (adminProductNew) adminProductNew.checked = product.isNew;
            if (adminProductSale) adminProductSale.checked = product.isSale;

            if (adminProductId) adminProductId.setAttribute('data-original-cat', product.categoryId);
        } else {
            if (adminModalTitle) adminModalTitle.textContent = "Add New Product";
            if (adminProductForm) adminProductForm.reset();
            if (adminProductId) adminProductId.value = '';
            if (adminProductId) adminProductId.removeAttribute('data-original-cat');

            // Reset image layout for new product
            const coverSection = document.getElementById('admin-cover-image-section');
            const uploadArea = document.getElementById('drive-upload-area');
            const editPreviewDiv = document.getElementById('admin-image-previews');
            const editStatusDiv = document.getElementById('drive-upload-status');
            const adminProductImageEl = document.getElementById('admin-product-image');

            if (coverSection) coverSection.style.display = 'none';
            if (uploadArea) uploadArea.style.display = 'flex';
            if (editPreviewDiv) editPreviewDiv.innerHTML = '';
            if (editStatusDiv) editStatusDiv.innerHTML = '';
            if (adminProductImageEl) adminProductImageEl.value = '';

            let catName = "";
            let catCheck = state.categories.find(c => c.slug === state.currentCategorySlug);
            if (catCheck) catName = catCheck.id;
            if (catName && adminProductCategory) adminProductCategory.value = catName;
        }

        if (adminModal) adminModal.style.display = 'flex';
    };

    window.deleteProduct = async function (categoryName, id) {
        if (confirm("Are you sure you want to delete this product?")) {
            try {
                await deleteDoc(doc(db, 'Products', categoryName, 'Items', id));
                // Remove from cart locally
                state.cart = state.cart.filter(item => item.id !== id);
                if (window.saveCart) window.saveCart();
            } catch (err) {
                console.error("Error deleting product:", err);
                alert("Database Error: Could not delete product.");
            }
        }
    };
}

// --- Custom Password Modal ---
let currentPasswordCallback = null;
export function promptPassword(title, callback) {
    if (passwordModalTitle) passwordModalTitle.textContent = title;
    if (passwordInput) passwordInput.value = '';
    currentPasswordCallback = callback;
    if (passwordModal) passwordModal.style.display = 'flex';
    setTimeout(() => { if (passwordInput) passwordInput.focus(); }, 100);
}

export function closePasswordModal() {
    if (passwordModal) passwordModal.style.display = 'none';
    currentPasswordCallback = null;

    if (window.location.pathname.includes('authenticate-admin') && !state.isAdmin) {
        if (state.routingInitialized && state.categories && state.categories.length > 0) {
            state.currentCategorySlug = state.categories[0].slug;
            if (window.updateUrlState) window.updateUrlState(state.currentCategorySlug);
            if (window.renderCategoryTabs) window.renderCategoryTabs();
            if (window.renderProducts) window.renderProducts(state.currentCategorySlug);
        }
    }
}
window.promptPassword = promptPassword;

export function promptDeleteCategory(cat) {
    promptPassword(`Delete "${cat.id}"? Enter password:`, async (pass) => {
        if (pass === atob("MDEyNw==")) {
            try {
                const itemsSnap = await getDocs(collection(db, 'Products', cat.id, 'Items'));
                const batchPromises = itemsSnap.docs.map(d => deleteDoc(d.ref));
                await Promise.all(batchPromises);
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
window.promptDeleteCategory = promptDeleteCategory;

// --- Admin Orders Engine ---
export function setupAdminOrderListeners() {
    const adminOrdersBtn = document.getElementById('admin-orders-btn');
    const adminOrdersCloseBtn = document.getElementById('admin-orders-close-btn');
    const adminOrdersView = document.getElementById('admin-orders-view');
    const checkoutView = document.getElementById('checkout-view');
    const mainLayoutContainer = document.getElementById('main-layout-container');

    if (adminOrdersBtn) {
        adminOrdersBtn.addEventListener('click', () => {
            if (window.closeCart) window.closeCart();
            if (mainLayoutContainer) mainLayoutContainer.style.display = 'none';
            if (checkoutView) checkoutView.style.display = 'none';
            if (adminOrdersView) adminOrdersView.style.display = 'block';
            loadAdminOrders();
        });
    }

    if (adminOrdersCloseBtn) {
        adminOrdersCloseBtn.addEventListener('click', () => {
            if (adminOrdersView) adminOrdersView.style.display = 'none';
            if (mainLayoutContainer) mainLayoutContainer.style.display = 'block';
        });
    }
}

// Attach Sync Images button listener
document.addEventListener('DOMContentLoaded', () => {
    const syncBtn = document.getElementById('admin-sync-btn');
    if (syncBtn) {
        syncBtn.addEventListener('click', () => {
            syncDriveImages();
        });
    }
});

export async function loadAdminOrders() {
    const adminOrdersList = document.getElementById('admin-orders-list');
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

        document.querySelectorAll('.admin-status-dropdown').forEach(sel => {
            sel.addEventListener('change', async (e) => {
                const oid = e.target.getAttribute('data-id');
                const uid = e.target.getAttribute('data-userid');
                const newStatus = e.target.value;
                try {
                    const batch = writeBatch(db);
                    batch.update(doc(db, 'Orders', oid), { status: newStatus });
                    if (uid !== "guest") {
                        batch.update(doc(db, 'Users', uid, 'Orders', oid), { status: newStatus });
                    }
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
        if (adminOrdersList) adminOrdersList.innerHTML = '<div style="color: #ff4444;">Failed to load orders. Check console.</div>';
    }
}
window.loadAdminOrders = loadAdminOrders;
