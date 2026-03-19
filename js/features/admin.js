import { state, setAdmin } from '../core/state.js';
import { db, doc, getDoc, setDoc, deleteDoc, getDocs, collection, writeBatch } from '../config/firebase.js';
import { generateSlug, getAbsoluteImageUrl } from '../core/utils.js';
import {
    adminToolsBanner, adminHeaderEditContainer, siteTitle, adminNavbarLogoutBtn,
    passwordModal, passwordModalTitle, passwordInput, passwordSubmitBtn, passwordCancelBtn,
    adminEditHeaderBtn, adminHeaderTitleInput, adminHeaderSubtitleInput, headerModal, closeHeaderModalBtn, headerCancelBtn, adminHeaderForm, homeTitle, homeSubtitle,
    categoryModal, closeCategoryModalBtn, categoryCancelBtn, categoryForm, newCategoryNameInput,
    adminModal, closeAdminModal, adminCancelBtn, adminProductForm, adminModalTitle, adminProductId, adminProductName, adminProductCategory, adminProductPrice, adminProductOffer,
    adminProductNew, adminProductSale, categoryTabsContainer
} from '../core/dom.js';

import { updateAuthUI } from './auth.js';
import { uploadImageToDrive, isDriveAuthorized, getDriveAccessToken, handleDriveAuthRedirect, renameDriveFile, deleteDriveFile } from './drive.js';

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

        // Always redirect admin to main page regardless of current page
        const productViewSection = document.getElementById('product-view');
        const shopSection = document.getElementById('shop');
        const checkoutView = document.getElementById('checkout-view');
        const adminOrdersView = document.getElementById('admin-orders-view');
        const mainLayoutContainer = document.getElementById('main-content');

        // Ensure main layout visible, hide other views
        if (checkoutView) checkoutView.style.display = 'none';
        if (adminOrdersView) adminOrdersView.style.display = 'none';
        if (mainLayoutContainer) mainLayoutContainer.style.display = 'block';
        if (productViewSection) productViewSection.style.display = 'none';
        if (shopSection) shopSection.style.display = 'block';

        // Hide chat widget in admin mode
        const chatWidget = document.getElementById('floating-chat-widget');
        if (chatWidget) chatWidget.style.display = 'none';

        // Check if admin was redirected from a specific URL
        const intendedUrl = sessionStorage.getItem('tc_admin_redirect');
        sessionStorage.removeItem('tc_admin_redirect');
        state.adminIntendedUrl = null;

        if (intendedUrl && intendedUrl.startsWith('/admin/')) {
            // Navigate to the intended admin page
            const basePath = intendedUrl.replace(/^\//, '');
            let baseUri = '/';
            if (window.location.pathname.startsWith('/toy_and_craft')) baseUri = '/toy_and_craft/';
            try {
                window.history.pushState({ path: baseUri + basePath }, '', baseUri + basePath);
            } catch (e) { }
            // Re-process the route to handle the intended page
            if (window.processRoute) window.processRoute();
            updateAuthUI();
            return;
        }

        // Default: go to first category
        if (state.categories && state.categories.length > 0) {
            state.currentCategorySlug = state.categories[0].slug;
        }
        if (window.updateUrlState) window.updateUrlState(state.currentCategorySlug, 1);

    } else {
        if (adminToolsBanner) adminToolsBanner.style.display = 'none';
        if (adminHeaderEditContainer) adminHeaderEditContainer.style.display = 'none';

        // Clean up any admin views or invoice that might be open
        const adminOrdersView = document.getElementById('admin-orders-view');
        const invoiceView = document.getElementById('invoice-view');
        const mainLayoutContainer = document.getElementById('main-content');
        const productViewSection = document.getElementById('product-view');
        const shopSection = document.getElementById('shop');

        if (adminOrdersView) adminOrdersView.style.display = 'none';
        if (invoiceView) invoiceView.style.display = 'none';
        if (mainLayoutContainer) mainLayoutContainer.style.display = 'block';
        if (productViewSection) productViewSection.style.display = 'none';
        if (shopSection) shopSection.style.display = 'block';

        // Show chat widget when leaving admin mode
        const chatWidget = document.getElementById('floating-chat-widget');
        if (chatWidget) chatWidget.style.display = 'block';

        // Restore footer
        const footer = document.querySelector('.footer');
        if (footer) footer.style.display = '';

        // Restore page title
        document.title = 'Toy & Craft';

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
            fileInput.addEventListener('change', () => {
                const files = Array.from(fileInput.files);
                if (!files.length) return;

                const catSlug = adminProductCategory.value || 'products';
                const carousel = document.getElementById('admin-image-carousel');
                const addCard = document.getElementById('admin-add-photo-card');
                const imageTextarea = document.getElementById('admin-product-image');
                
                if (statusDiv) statusDiv.innerHTML = '';
                
                const existingUrls = imageTextarea ? imageTextarea.value.split(',').map(s => s.trim()).filter(Boolean) : [];
                const allUrls = [...existingUrls];

                const baseName = adminProductName.value.trim() || 'product';
                const safeBaseName = baseName.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/(^-|-$)/g, '');

                const uploadPromises = files.map((file, i) => {
                    const ext = file.name.split('.').pop();
                    const index = allUrls.length + i + 1;
                    const customFileName = `${safeBaseName}-${index}.${ext}`;

                    // 1. Create Placeholder Card DOM
                    const card = document.createElement('div');
                    card.className = 'admin-upload-placeholder';
                    card.style.cssText = `
                        flex: 0 0 160px; height: 160px; border-radius: 8px; overflow: hidden; position: relative;
                        box-shadow: 0 2px 8px rgba(0,0,0,0.1); background: #eee; scroll-snap-align: start;
                    `;
                    
                    const imgPreview = document.createElement('img');
                    imgPreview.style.cssText = 'width: 100%; height: 100%; object-fit: contain; pointer-events: none; filter: grayscale(100%) brightness(0.5); transition: filter 0.3s;';
                    card.appendChild(imgPreview);
                    
                    const reader = new FileReader();
                    reader.onload = (e) => { imgPreview.src = e.target.result; };
                    reader.readAsDataURL(file);

                    // A fill overlay that visually drops down as progress increases
                    const fillOverlay = document.createElement('div');
                    fillOverlay.style.cssText = 'position: absolute; top: 0; left: 0; right: 0; bottom: 0; background: rgba(0, 0, 0, 0.6); transition: bottom 0.1s linear;';
                    card.appendChild(fillOverlay);

                    const textOverlay = document.createElement('div');
                    textOverlay.style.cssText = 'position: absolute; inset: 0; display: flex; align-items: center; justify-content: center; flex-direction: column; color: white; font-weight: bold; font-size: 1.5rem; text-shadow: 0 2px 4px rgba(0,0,0,0.5);';
                    
                    const percentText = document.createElement('span');
                    percentText.innerText = '0%';
                    textOverlay.appendChild(percentText);
                    card.appendChild(textOverlay);

                    let abortUpload = null;
                    const cancelBtn = document.createElement('button');
                    cancelBtn.innerHTML = '<span class="material-icons-round" style="font-size:16px;">close</span>';
                    cancelBtn.style.cssText = 'position: absolute; top: 8px; right: 8px; background: rgba(0,0,0,0.6); color: white; border: none; border-radius: 50%; width: 24px; height: 24px; display: flex; align-items: center; justify-content: center; cursor: pointer; transition: all 0.2s; z-index: 10;';
                    cancelBtn.onmouseover = () => cancelBtn.style.background = 'rgba(255,50,50,0.8)';
                    cancelBtn.onmouseout = () => cancelBtn.style.background = 'rgba(0,0,0,0.6)';
                    cancelBtn.onclick = (e) => {
                        e.preventDefault();
                        e.stopPropagation();
                        if (abortUpload) abortUpload();
                        card.remove(); 
                    };
                    card.appendChild(cancelBtn);

                    if (carousel && addCard) {
                        carousel.insertBefore(card, addCard);
                    }

                    return new Promise((resolve, reject) => {
                        try {
                            const { promise, abort } = uploadImageToDrive(file, catSlug, customFileName, (pct) => {
                                const rounded = Math.round(pct);
                                percentText.innerText = `${rounded}%`;
                                // The background overlay recedes downwards to "reveal" the image
                                fillOverlay.style.bottom = `${rounded}%`;
                                // Image regains color as it uploads
                                imgPreview.style.filter = `grayscale(${100 - rounded}%) brightness(${0.5 + (rounded / 200)})`;
                            });
                            abortUpload = abort;
                            promise.then(url => {
                                resolve({ url, file, card });
                            }).catch(err => {
                                card.remove();
                                reject({ err, file });
                            });
                        } catch (err) {
                            card.remove();
                            reject({ err, file });
                        }
                    });
                });

                let uploadsInProgress = true;
                const submitBtn = adminProductForm.querySelector('[type="submit"]');
                if (submitBtn) { submitBtn.disabled = true; submitBtn.textContent = 'Uploading...'; }

                pendingUploadPromise = Promise.allSettled(uploadPromises).then(results => {
                    results.forEach(res => {
                        if (res.status === 'fulfilled' && res.value && res.value.url) {
                            allUrls.push(res.value.url);
                            
                            // Visual indication of success before vanishing
                            const finalCardText = res.value.card.querySelector('span');
                            if (finalCardText) {
                                finalCardText.innerText = '100%';
                                finalCardText.style.color = '#4ade80';
                            }
                            
                            // Delay removal so user sees 100% for an instant on ultra-fast network connections
                            setTimeout(() => {
                                res.value.card.remove(); 
                            }, 800);
                            
                        } else if (res.status === 'rejected' && res.reason && res.reason.err) {
                            console.error('Upload Error for', res.reason.file.name, ':', res.reason.err);
                            alert(`Upload Error for ${res.reason.file.name}:\n${res.reason.err.message || res.reason.err}`);
                        }
                    });
                    
                    if (imageTextarea) imageTextarea.value = allUrls.join(', ');
                    if (window.renderAdminImageCarousel) window.renderAdminImageCarousel();

                    uploadsInProgress = false;
                    if (submitBtn) { submitBtn.disabled = false; submitBtn.textContent = 'Save Product'; }

                    // Clear input after all uploads complete to avoid Blob invalidation race conditions on PC browsers
                    fileInput.value = '';
                });
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

        // Add paste-to-upload support
        const carousel = document.getElementById('admin-image-carousel');
        if (carousel && fileInput) {
            carousel.addEventListener('paste', async (e) => {
                const items = (e.clipboardData || e.originalEvent.clipboardData).items;
                const files = [];
                for (let index in items) {
                    const item = items[index];
                    if (item.kind === 'file' && item.type.startsWith('image/')) {
                        const blob = item.getAsFile();
                        files.push(new File([blob], `pasted-image-${Date.now()}.${blob.type.split('/')[1]}`, { type: blob.type }));
                    }
                }
                
                if (files.length > 0) {
                    e.preventDefault();
                    const dataTransfer = new DataTransfer();
                    files.forEach(f => dataTransfer.items.add(f));
                    fileInput.files = dataTransfer.files;
                    fileInput.dispatchEvent(new Event('change'));
                }
            });
            // Allow clicking carousel void space to focus for paste
            carousel.addEventListener('click', (e) => {
                if (e.target === carousel) carousel.focus();
            });
        }
    }

    // Carousel Renderer Helper
    window.renderAdminImageCarousel = function() {
        const carousel = document.getElementById('admin-image-carousel');
        const addCard = document.getElementById('admin-add-photo-card');
        const imageTextarea = document.getElementById('admin-product-image');
        if (!carousel || !addCard || !imageTextarea) return;

        const existingCards = carousel.querySelectorAll('.admin-image-card');
        existingCards.forEach(c => c.remove());
        // Preserves placeholders since they have '.admin-upload-placeholder' class instead

        const urls = imageTextarea.value.split(',').map(s => s.trim()).filter(Boolean);
        
        urls.forEach((url, index) => {
            const card = document.createElement('div');
            card.className = 'admin-image-card';
            card.draggable = true;
            card.dataset.index = index;
            card.style.cssText = `
                flex: 0 0 160px; height: 160px; border-radius: 8px; overflow: hidden; position: relative;
                box-shadow: 0 2px 8px rgba(0,0,0,0.1); cursor: grab; background: #fff; scroll-snap-align: start;
                border: 2px solid transparent; transition: border 0.2s;
            `;
            
            const img = document.createElement('img');
            img.src = getAbsoluteImageUrl(url);
            img.style.cssText = 'width: 100%; height: 100%; object-fit: contain; pointer-events: none;';
            card.appendChild(img);

            if (index === 0) {
                const mainBadge = document.createElement('div');
                mainBadge.textContent = 'Main';
                mainBadge.style.cssText = 'position: absolute; top: 8px; left: 8px; background: var(--primary); color: white; padding: 2px 6px; border-radius: 4px; font-size: 0.7rem; font-weight: bold; pointer-events: none;box-shadow: 0 2px 4px rgba(0,0,0,0.2)';
                card.appendChild(mainBadge);
            }

            const deleteBtn = document.createElement('button');
            deleteBtn.innerHTML = '<span class="material-icons-round" style="font-size:16px;">close</span>';
            deleteBtn.style.cssText = 'position: absolute; top: 8px; right: 8px; background: rgba(0,0,0,0.6); color: white; border: none; border-radius: 50%; width: 24px; height: 24px; display: flex; align-items: center; justify-content: center; cursor: pointer; transition: all 0.2s;';
            deleteBtn.onmouseover = () => deleteBtn.style.background = 'rgba(255,50,50,0.8)';
            deleteBtn.onmouseout = () => deleteBtn.style.background = 'rgba(0,0,0,0.6)';
            deleteBtn.onclick = async (e) => {
                e.preventDefault();
                e.stopPropagation();
                if (confirm('Remove this image? It will be deleted from your Google Drive instantly.')) {
                    const targetUrl = urls[index];
                    
                    // Show a tiny spinner locally on the button
                    deleteBtn.innerHTML = '<span class="material-icons-round" style="font-size:16px;animation:spin 1s linear infinite;">sync</span>';
                    
                    const deleted = await deleteDriveFile(targetUrl);
                    
                    if (deleted) {
                        urls.splice(index, 1);
                        imageTextarea.value = urls.join(', ');
                        window.renderAdminImageCarousel();
                    } else {
                        alert("Warning: Could not immediately remove from Drive (it might be locked or missing data), but it has been removed from this product visually.");
                        urls.splice(index, 1);
                        imageTextarea.value = urls.join(', ');
                        window.renderAdminImageCarousel();
                    }
                }
            };
            card.appendChild(deleteBtn);

            card.addEventListener('dragstart', (e) => {
                e.dataTransfer.setData('text/plain', index.toString());
                card.style.opacity = '0.5';
            });
            card.addEventListener('dragend', (e) => {
                card.style.opacity = '1';
                carousel.querySelectorAll('.admin-image-card').forEach(c => c.style.borderColor = 'transparent');
            });
            card.addEventListener('dragover', (e) => {
                e.preventDefault();
                card.style.borderColor = 'var(--primary)';
            });
            card.addEventListener('dragleave', (e) => {
                card.style.borderColor = 'transparent';
            });
            card.addEventListener('drop', (e) => {
                e.preventDefault();
                card.style.borderColor = 'transparent';
                const fromIndex = parseInt(e.dataTransfer.getData('text/plain'));
                const toIndex = index;
                if (!isNaN(fromIndex) && fromIndex !== toIndex) {
                    const item = urls.splice(fromIndex, 1)[0];
                    urls.splice(toIndex, 0, item);
                    imageTextarea.value = urls.join(', ');
                    window.renderAdminImageCarousel();
                }
            });

            carousel.insertBefore(card, addCard);
        });
    };

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

            // Handle image UI
            const editStatusDiv = document.getElementById('drive-upload-status');
            if (editStatusDiv) editStatusDiv.innerHTML = '';
            if (window.renderAdminImageCarousel) window.renderAdminImageCarousel();

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
            const editStatusDiv = document.getElementById('drive-upload-status');
            const adminProductImageEl = document.getElementById('admin-product-image');

            if (editStatusDiv) editStatusDiv.innerHTML = '';
            if (adminProductImageEl) adminProductImageEl.value = '';
            if (window.renderAdminImageCarousel) window.renderAdminImageCarousel();

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

// Navigate to an admin sub-page via URL
function navigateToAdminPage(page) {
    if (window.closeCart) window.closeCart();
    if (window.updateUrlState) window.updateUrlState(page);

    const adminOrdersView = document.getElementById('admin-orders-view');
    const checkoutView = document.getElementById('checkout-view');
    const mainLayoutContainer = document.getElementById('main-content');
    const productViewSection = document.getElementById('product-view');
    const shopSection = document.getElementById('shop');
    const adminViewTitle = document.getElementById('admin-view-title');

    if (mainLayoutContainer) mainLayoutContainer.style.display = 'none';
    if (checkoutView) checkoutView.style.display = 'none';
    if (productViewSection) productViewSection.style.display = 'none';
    if (shopSection) shopSection.style.display = 'none';
    if (adminOrdersView) adminOrdersView.style.display = 'block';

    if (adminViewTitle) {
        if (page === 'all-orders') adminViewTitle.innerText = 'System Orders';
        else if (page === 'users-list') adminViewTitle.innerText = 'Registered Users';
        else if (page === 'sold-products') adminViewTitle.innerText = 'Sold Products Performance';
    }
}
window.navigateToAdminPage = navigateToAdminPage;

export function setupAdminOrderListeners() {
    const adminOrdersBtn = document.getElementById('admin-orders-btn');
    const adminUsersBtn = document.getElementById('admin-users-btn');
    const adminSoldProductsBtn = document.getElementById('admin-sold-products-btn');
    const adminOrdersCloseBtn = document.getElementById('admin-orders-close-btn');

    if (adminOrdersBtn) {
        adminOrdersBtn.addEventListener('click', () => {
            navigateToAdminPage('all-orders');
            if (adminSoldProductsBtn) adminSoldProductsBtn.style.opacity = '0.6';
            if (adminUsersBtn) adminUsersBtn.style.opacity = '0.6';
            if (adminOrdersBtn) adminOrdersBtn.style.opacity = '1';
            loadAdminOrders();
        });
    }

    if (adminUsersBtn) {
        adminUsersBtn.addEventListener('click', () => {
            navigateToAdminPage('users-list');
            if (adminOrdersBtn) adminOrdersBtn.style.opacity = '0.6';
            if (adminSoldProductsBtn) adminSoldProductsBtn.style.opacity = '0.6';
            if (adminUsersBtn) adminUsersBtn.style.opacity = '1';
            loadAdminUsers();
        });
    }

    if (adminSoldProductsBtn) {
        adminSoldProductsBtn.addEventListener('click', () => {
            navigateToAdminPage('sold-products');
            if (adminSoldProductsBtn) adminSoldProductsBtn.style.opacity = '1';
            if (adminOrdersBtn) adminOrdersBtn.style.opacity = '0.6';
            if (adminUsersBtn) adminUsersBtn.style.opacity = '0.6';
            renderAdminSoldProducts();
        });
    }

    if (adminOrdersCloseBtn) {
        adminOrdersCloseBtn.addEventListener('click', () => {
            const adminOrdersView = document.getElementById('admin-orders-view');
            const mainLayoutContainer = document.getElementById('main-content');
            if (adminOrdersView) adminOrdersView.style.display = 'none';
            if (mainLayoutContainer) mainLayoutContainer.style.display = 'block';
            // Navigate back to admin main page
            if (state.categories && state.categories.length > 0) {
                state.currentCategorySlug = state.categories[0].slug;
            }
            if (window.updateUrlState) window.updateUrlState(state.currentCategorySlug, 1);
            const shopSection = document.getElementById('shop');
            if (shopSection) shopSection.style.display = 'block';
            if (window.renderProducts) window.renderProducts(state.currentCategorySlug, 1);
        });
    }
}

export async function loadAdminOrders(filterStatus = null) {
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

        let orders = snapshots.docs.map(d => ({ id: d.id, ...d.data() })).sort((a, b) => b.createdAt - a.createdAt);

        if (filterStatus) {
            orders = orders.filter(o => o.status === filterStatus);
        }

        if (orders.length === 0) {
            adminOrdersList.innerHTML = '<div style="color: var(--text-muted);">No orders match the current view.</div>';
            return;
        }

        orders.forEach(order => {
            const dateStr = new Date(order.createdAt).toLocaleString();
            const itemsHTML = (order.items || []).map(i => `• ${i.name} (x${i.qty}) - ৳${(i.price || 0).toFixed(2)}`).join('<br>');

            const li = document.createElement('div');
            const statusClass = (order.status || 'Pending').toLowerCase();
            li.className = `admin-order-card ${statusClass}`;
            
            // Background colors based on status (light versions)
            let bgColor = 'var(--bg-card)';
            if (order.status === 'Pending') bgColor = 'rgba(255, 145, 0, 0.08)';
            else if (order.status === 'Sent') bgColor = 'rgba(0, 123, 255, 0.08)';
            else if (order.status === 'Delivered') bgColor = 'rgba(34, 197, 94, 0.08)';

            li.style.cssText = `padding: 1rem; border: 1px solid var(--border-color); border-radius: var(--radius-sm); display: flex; flex-direction: column; gap: 0.5rem; background: ${bgColor}; margin-bottom: 1rem; transition: background 0.3s ease;`;

            const statusBadgeClass = order.status === 'Delivered' ? 'status-delivered' : (order.status === 'Sent' ? 'status-sent' : 'status-pending');

            li.innerHTML = `
                <div style="display: flex; justify-content: space-between; border-bottom: 1px solid var(--border-color); padding-bottom: 0.5rem; flex-wrap: wrap; gap: 10px;">
                    <div><strong>Order ID:</strong> ${order.id}</div>
                    <div style="display: flex; align-items: center; gap: 10px;">
                         <a href="admin/all-orders/${order.id}" class="btn btn-secondary btn-sm" style="padding: 0.2rem 0.6rem; font-size: 0.75rem; border-radius: 4px;" onclick="event.preventDefault(); updateUrlState('all-orders', 1, '${order.id}'); processRoute();">
                            <span class="material-icons-round" style="font-size: 14px; margin-right: 4px;">receipt_long</span> Invoice
                        </a>
                        <div style="font-size: 0.85rem; color: var(--text-muted);">${dateStr}</div>
                    </div>
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
                    <div style="font-weight: 600;">Total: ৳${(order.totalPrice || 0).toFixed(2)}</div>
                    <div style="display: flex; gap: 10px; align-items: center;">
                        <span class="status-badge ${statusBadgeClass}">${order.status || 'Pending'}</span>
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

                    const badge = e.target.previousElementSibling;
                    const newBadgeClass = newStatus === 'Delivered' ? 'status-delivered' : (newStatus === 'Sent' ? 'status-sent' : 'status-pending');
                    badge.className = `status-badge ${newBadgeClass}`;
                    badge.innerText = newStatus;

                    const card = e.target.closest('.admin-order-card');
                    if (card) {
                        card.classList.remove('pending', 'sent', 'delivered');
                        card.classList.add(newStatus.toLowerCase());
                    }

                    // If we are currently filtering by Sold and this is changed, we might want to reload, 
                    // but for now, just let the color change reflect it.
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

// --- Admin Sold Products Analytics ---
export async function renderAdminSoldProducts() {
    const adminOrdersList = document.getElementById('admin-orders-list');
    if (!adminOrdersList) return;
    adminOrdersList.innerHTML = '<div style="color: var(--text-muted);">Analyzing sold products...</div>';

    try {
        const snapshots = await getDocs(collection(db, 'Orders'));
        adminOrdersList.innerHTML = '';

        if (snapshots.empty) {
            adminOrdersList.innerHTML = '<div style="color: var(--text-muted);">No orders in the system.</div>';
            return;
        }

        const deliveredOrders = snapshots.docs
            .map(d => ({ id: d.id, ...d.data() }))
            .filter(o => o.status === 'Delivered');

        if (deliveredOrders.length === 0) {
            adminOrdersList.innerHTML = '<div style="color: var(--text-muted);">No sold products yet.</div>';
            return;
        }

        // Aggregate products
        const productMap = {};
        let grandTotalRevenue = 0;
        let grandTotalItemsSold = 0;

        deliveredOrders.forEach(order => {
            (order.items || []).forEach(item => {
                const key = item.id || item.name;
                if (!productMap[key]) {
                    productMap[key] = {
                        name: item.name,
                        totalQty: 0,
                        totalRevenue: 0,
                        prices: [],
                        orderCount: 0
                    };
                }
                productMap[key].totalQty += item.qty;
                productMap[key].totalRevenue += item.price * item.qty;
                productMap[key].prices.push(item.price);
                productMap[key].orderCount += 1;
                grandTotalRevenue += item.price * item.qty;
                grandTotalItemsSold += item.qty;
            });
        });

        const products = Object.values(productMap).sort((a, b) => b.totalRevenue - a.totalRevenue);

        // Summary card
        const summaryCard = document.createElement('div');
        summaryCard.style.cssText = 'display: grid; grid-template-columns: repeat(auto-fit, minmax(180px, 1fr)); gap: 1rem; margin-bottom: 2rem;';
        summaryCard.innerHTML = `
            <div style="background: linear-gradient(135deg, #667eea, #764ba2); color: white; padding: 1.5rem; border-radius: var(--radius-md); text-align: center;">
                <div style="font-size: 2rem; font-weight: bold;">${deliveredOrders.length}</div>
                <div style="font-size: 0.9rem; opacity: 0.9;">Completed Orders</div>
            </div>
            <div style="background: linear-gradient(135deg, #f093fb, #f5576c); color: white; padding: 1.5rem; border-radius: var(--radius-md); text-align: center;">
                <div style="font-size: 2rem; font-weight: bold;">${grandTotalItemsSold}</div>
                <div style="font-size: 0.9rem; opacity: 0.9;">Total Items Sold</div>
            </div>
            <div style="background: linear-gradient(135deg, #4facfe, #00f2fe); color: white; padding: 1.5rem; border-radius: var(--radius-md); text-align: center;">
                <div style="font-size: 2rem; font-weight: bold;">${products.length}</div>
                <div style="font-size: 0.9rem; opacity: 0.9;">Unique Products</div>
            </div>
            <div style="background: linear-gradient(135deg, #43e97b, #38f9d7); color: white; padding: 1.5rem; border-radius: var(--radius-md); text-align: center;">
                <div style="font-size: 2rem; font-weight: bold;">৳${(grandTotalRevenue || 0).toFixed(2)}</div>
                <div style="font-size: 0.9rem; opacity: 0.9;">Total Revenue</div>
            </div>
        `;
        adminOrdersList.appendChild(summaryCard);

        // Product table
        const tableWrap = document.createElement('div');
        tableWrap.style.cssText = 'overflow-x: auto; border-radius: var(--radius-md); border: 1px solid var(--border-color);';

        let tableHTML = `
            <table style="width: 100%; border-collapse: collapse; font-size: 0.9rem;">
                <thead>
                    <tr style="background: var(--bg-hover); text-align: left;">
                        <th style="padding: 1rem; border-bottom: 2px solid var(--border-color); font-weight: 600;">#</th>
                        <th style="padding: 1rem; border-bottom: 2px solid var(--border-color); font-weight: 600;">Product Name</th>
                        <th style="padding: 1rem; border-bottom: 2px solid var(--border-color); font-weight: 600; text-align: center;">Qty Sold</th>
                        <th style="padding: 1rem; border-bottom: 2px solid var(--border-color); font-weight: 600; text-align: center;">Orders</th>
                        <th style="padding: 1rem; border-bottom: 2px solid var(--border-color); font-weight: 600; text-align: right;">Unit Price</th>
                        <th style="padding: 1rem; border-bottom: 2px solid var(--border-color); font-weight: 600; text-align: right;">Avg Price</th>
                        <th style="padding: 1rem; border-bottom: 2px solid var(--border-color); font-weight: 600; text-align: right;">Total Revenue</th>
                    </tr>
                </thead>
                <tbody>
        `;

        products.forEach((prod, idx) => {
            const avgPrice = prod.totalRevenue / prod.totalQty;
            const minPrice = Math.min(...prod.prices);
            const maxPrice = Math.max(...prod.prices);
            const priceRange = minPrice === maxPrice ? `৳${(minPrice || 0).toFixed(2)}` : `৳${(minPrice || 0).toFixed(2)} - ৳${(maxPrice || 0).toFixed(2)}`;

            tableHTML += `
                <tr style="border-bottom: 1px solid var(--border-color);">
                    <td style="padding: 0.85rem 1rem; color: var(--text-muted);">${idx + 1}</td>
                    <td style="padding: 0.85rem 1rem; font-weight: 500;">${prod.name}</td>
                    <td style="padding: 0.85rem 1rem; text-align: center; font-weight: bold; color: var(--primary);">${prod.totalQty}</td>
                    <td style="padding: 0.85rem 1rem; text-align: center; color: var(--text-muted);">${prod.orderCount}</td>
                    <td style="padding: 0.85rem 1rem; text-align: right; color: var(--text-muted);">${priceRange}</td>
                    <td style="padding: 0.85rem 1rem; text-align: right;">৳${(avgPrice || 0).toFixed(2)}</td>
                    <td style="padding: 0.85rem 1rem; text-align: right; font-weight: bold; color: #22c55e;">৳${(prod.totalRevenue || 0).toFixed(2)}</td>
                </tr>
            `;
        });

        tableHTML += `
                </tbody>
                <tfoot>
                    <tr style="background: var(--bg-hover); font-weight: bold;">
                        <td colspan="2" style="padding: 1rem;">Grand Total</td>
                        <td style="padding: 1rem; text-align: center; color: var(--primary);">${grandTotalItemsSold}</td>
                        <td style="padding: 1rem; text-align: center;">${deliveredOrders.length}</td>
                        <td colspan="2" style="padding: 1rem;"></td>
                        <td style="padding: 1rem; text-align: right; color: #22c55e;">৳${(grandTotalRevenue || 0).toFixed(2)}</td>
                    </tr>
                </tfoot>
            </table>
        `;

        tableWrap.innerHTML = tableHTML;
        adminOrdersList.appendChild(tableWrap);

    } catch (e) {
        console.error("Admin Sold Products Error", e);
        if (adminOrdersList) adminOrdersList.innerHTML = '<div style="color: #ff4444;">Failed to load sold products. Check console.</div>';
    }
}
window.renderAdminSoldProducts = renderAdminSoldProducts;

// --- Admin Users List ---
export async function loadAdminUsers() {
    const adminOrdersList = document.getElementById('admin-orders-list');
    if (!adminOrdersList) return;
    adminOrdersList.innerHTML = '<div style="color: var(--text-muted);">Fetching registered users...</div>';

    try {
        const snapshots = await getDocs(collection(db, 'Users'));
        adminOrdersList.innerHTML = '';

        if (snapshots.empty) {
            adminOrdersList.innerHTML = '<div style="color: var(--text-muted);">No users found in the system.</div>';
            return;
        }

        const users = snapshots.docs.map(d => ({ id: d.id, ...d.data() }));

        const tableWrap = document.createElement('div');
        tableWrap.style.cssText = 'overflow-x: auto; border-radius: var(--radius-md); border: 1px solid var(--border-color); background: var(--bg-card);';

        let tableHTML = `
            <table style="width: 100%; border-collapse: collapse; font-size: 0.9rem;">
                <thead>
                    <tr style="background: var(--bg-hover); text-align: left;">
                        <th style="padding: 1rem; border-bottom: 2px solid var(--border-color); font-weight: 600;">User Info</th>
                        <th style="padding: 1rem; border-bottom: 2px solid var(--border-color); font-weight: 600;">Contact</th>
                        <th style="padding: 1rem; border-bottom: 2px solid var(--border-color); font-weight: 600;">Address</th>
                        <th style="padding: 1rem; border-bottom: 2px solid var(--border-color); font-weight: 600; text-align: right;">Joined</th>
                    </tr>
                </thead>
                <tbody>
        `;

        users.forEach(user => {
            const joinedDate = user.createdAt ? new Date(user.createdAt).toLocaleDateString() : 'N/A';
            tableHTML += `
                <tr style="border-bottom: 1px solid var(--border-color);">
                    <td style="padding: 0.85rem 1rem;">
                        <div style="font-weight: 600; color: var(--text-main);">${user.username || 'N/A'}</div>
                        <div style="font-size: 0.75rem; color: var(--primary); font-family: monospace;">${user.id}</div>
                    </td>
                    <td style="padding: 0.85rem 1rem;">
                        <div style="display: flex; align-items: center; gap: 5px; margin-bottom: 2px;">
                            <span class="material-icons-round" style="font-size: 14px; color: var(--text-muted);">email</span>
                            <span>${user.email || 'N/A'}</span>
                        </div>
                        <div style="display: flex; align-items: center; gap: 5px;">
                            <span class="material-icons-round" style="font-size: 14px; color: var(--text-muted);">phone</span>
                            <span>${user.mobile || 'N/A'}</span>
                        </div>
                    </td>
                    <td style="padding: 0.85rem 1rem; color: var(--text-muted); font-size: 0.8rem; max-width: 250px;">
                        ${user.address || 'No address saved.'}<br>
                        <strong>${user.thana || ''}, ${user.district || ''}</strong>
                    </td>
                    <td style="padding: 0.85rem 1rem; text-align: right; color: var(--text-muted); font-size: 0.8rem;">
                        ${joinedDate}
                    </td>
                </tr>
            `;
        });

        tableHTML += `</tbody></table>`;
        tableWrap.innerHTML = tableHTML;
        adminOrdersList.appendChild(tableWrap);

    } catch (e) {
        console.error("Admin Load Users Error", e);
        if (adminOrdersList) adminOrdersList.innerHTML = '<div style="color: #ff4444;">Failed to load users. Check console.</div>';
    }
}
window.loadAdminUsers = loadAdminUsers;
