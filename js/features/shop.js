import { state } from '../core/state.js';
import { db, doc, updateDoc, writeBatch } from '../config/firebase.js';
import { generateSlug, getAbsoluteImageUrl, showErrorPage } from '../core/utils.js';
import {
    productGrid, categoryTabsContainer, prevPageBtn, nextPageBtn, pageIndicator,
    productViewSection, shopSection, backToShopBtn, pvMainImage, pvThumbnails, pvCategory,
    pvTitle, pvPrice, pvDescription, pvQty, pvQtyDec, pvQtyInc, pvStockStatus, pvAddToCart,
    pvAdminActions, pvAdminEdit, imageExpanderModal, expandedImage, closeImageExpander
} from '../core/dom.js';

// --- Category Drag and Drop Functions ---
function handleDragStart(e) {
    state.draggedCategorySlug = e.target.getAttribute('data-category');
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

    const targetElement = e.target.closest('.tab-btn');
    if (!targetElement) return;

    const targetSlug = targetElement.getAttribute('data-category');

    document.querySelectorAll('.tab-btn').forEach(btn => btn.classList.remove('dragging', 'drag-over'));

    if (state.draggedCategorySlug && targetSlug && state.draggedCategorySlug !== targetSlug) {
        const oldIndex = state.categories.findIndex(c => c.slug === state.draggedCategorySlug);
        const newIndex = state.categories.findIndex(c => c.slug === targetSlug);

        if (oldIndex > -1 && newIndex > -1) {
            const [movedItem] = state.categories.splice(oldIndex, 1);
            state.categories.splice(newIndex, 0, movedItem);

            state.categories.forEach((cat, idx) => {
                cat.order = idx;
            });

            renderCategoryTabs();

            try {
                const batch = writeBatch(db);
                state.categories.forEach(cat => {
                    batch.update(doc(db, 'Products', cat.id), { order: cat.order });
                });
                await batch.commit();
            } catch (err) {
                console.error("Error updating sort order", err);
            }
        }
    }
    state.draggedCategorySlug = null;
}

// --- UI Rendering ---
export function getCategoryNameFromSlug(slug) {
    const cat = state.categories.find(c => c.slug === slug);
    return cat ? cat.id : slug;
}
window.getCategoryNameFromSlug = getCategoryNameFromSlug;

export function renderCategoryTabs() {
    if (!categoryTabsContainer) return;
    categoryTabsContainer.innerHTML = '';

    if (state.categories.length === 0) {
        const msg = document.createElement('span');
        msg.className = 'text-muted';
        msg.textContent = 'No categories found.';
        categoryTabsContainer.appendChild(msg);
    } else {
        if (!state.categories.find(c => c.slug === state.currentCategorySlug)) {
            state.currentCategorySlug = state.categories[0].slug;
        }

        state.categories.forEach(cat => {
            const btn = document.createElement('button');
            btn.className = `tab-btn ${cat.slug === state.currentCategorySlug ? 'active' : ''}`;
            btn.setAttribute('data-category', cat.slug);
            btn.textContent = cat.id;

            if (state.isAdmin) {
                btn.draggable = true;
                btn.classList.add('draggable-tab');

                const delBtn = document.createElement('button');
                delBtn.className = 'delete-category-btn';
                delBtn.innerHTML = '<span class="material-icons-round" style="font-size: 14px;">delete</span>';
                delBtn.onclick = (e) => {
                    e.stopPropagation();
                    if (window.promptDeleteCategory) window.promptDeleteCategory(cat);
                };
                btn.appendChild(delBtn);

                btn.addEventListener('dragstart', handleDragStart);
                btn.addEventListener('dragover', handleDragOver);
                btn.addEventListener('drop', handleDrop);
                btn.addEventListener('dragenter', handleDragEnter);
                btn.addEventListener('dragleave', handleDragLeave);
            }

            btn.onclick = (e) => {
                if (e.type === 'drag') return;

                // Save current state before switching
                if (state.currentCategorySlug) {
                    state.categoryMemory[state.currentCategorySlug] = {
                        page: state.currentPage || 1,
                        scroll: window.scrollY
                    };
                }

                if (shopSection && shopSection.style.display === 'none') {
                    if (productViewSection) productViewSection.style.display = 'none';
                    const trackView = document.getElementById('track-view');
                    if (trackView) trackView.style.display = 'none';
                    shopSection.style.display = 'block';
                }

                categoryTabsContainer.querySelectorAll('.tab-btn').forEach(b => b.classList.remove('active'));
                btn.classList.add('active');
                state.currentCategorySlug = cat.slug;
                
                // Restore state from memory if available
                const memory = state.categoryMemory[state.currentCategorySlug];
                const targetPage = memory ? memory.page : 1;
                const targetScroll = memory ? memory.scroll : 0;

                if (window.updateTabSlider) window.updateTabSlider();
                if (window._syncFloatingClone) window._syncFloatingClone();
                
                renderProducts(state.currentCategorySlug, targetPage, targetScroll);
                if (window.updateUrlState) window.updateUrlState(state.currentCategorySlug, targetPage);
            };
            categoryTabsContainer.appendChild(btn);
        });
    }

    if (state.isAdmin) {
        const addBtn = document.createElement('button');
        addBtn.className = 'tab-btn add-category-btn';
        addBtn.innerHTML = '+ Add Category';
        addBtn.onclick = () => {
            if (window.categoryForm) window.categoryForm.reset();
            if (window.categoryModal) window.categoryModal.style.display = 'flex';
        };
        categoryTabsContainer.appendChild(addBtn);
    }

    // --- Sliding Tab Indicator Logic ---
    let slider = categoryTabsContainer.querySelector('.tab-slider');
    if (!slider) {
        slider = document.createElement('div');
        slider.className = 'tab-slider';
        categoryTabsContainer.appendChild(slider);
    }

    const updateTabSlider = () => {
        const activeBtn = categoryTabsContainer.querySelector('.tab-btn.active');
        if (activeBtn && slider) {
            slider.style.width = activeBtn.offsetWidth + 'px';
            slider.style.height = activeBtn.offsetHeight + 'px';
            slider.style.left = activeBtn.offsetLeft + 'px';
            slider.style.top = activeBtn.offsetTop + 'px';
        }
    };

    // Delay initial render slightly to ensure DOM has painted widths
    setTimeout(updateTabSlider, 50);

    // Make update method exposed globally if needed
    window.updateTabSlider = updateTabSlider;

    // Remove old listeners to avoid memory leaks if re-rendered
    if (window._tabResizeListener) {
        window.removeEventListener('resize', window._tabResizeListener);
    }
    window._tabResizeListener = updateTabSlider;
    window.addEventListener('resize', window._tabResizeListener);

}
window.renderCategoryTabs = renderCategoryTabs;

export function renderProducts(categorySlug, page = 1, targetScroll = null) {
    if (!productGrid) return;
    productGrid.innerHTML = '';
    const errorViewSection = document.getElementById('error-view');
    if (errorViewSection) errorViewSection.style.display = 'none';

    state.currentPage = page;

    if (state.isAdmin) {
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

    const filteredProducts = state.inventory.filter(p => p.categorySlug === categorySlug);

    // Apply sorting
    if (state.currentSort === 'a-z') {
        filteredProducts.sort((a, b) => (a.name || '').localeCompare(b.name || ''));
    } else if (state.currentSort === 'z-a') {
        filteredProducts.sort((a, b) => (b.name || '').localeCompare(a.name || ''));
    } else if (state.currentSort === 'price-low') {
        filteredProducts.sort((a, b) => (a.offerPrice || a.price) - (b.offerPrice || b.price));
    } else if (state.currentSort === 'price-high') {
        filteredProducts.sort((a, b) => (b.offerPrice || b.price) - (a.offerPrice || a.price));
    }
    if (filteredProducts.length === 0 && !state.isAdmin) {
        productGrid.innerHTML = '<div style="grid-column: 1/-1; text-align: center; color: var(--text-muted); padding: 3rem;">No products found in this category.</div>';
        if (prevPageBtn) prevPageBtn.disabled = true;
        if (nextPageBtn) nextPageBtn.disabled = true;
        if (pageIndicator) pageIndicator.textContent = 'Page 1 of 1';
        return;
    }

    const totalPages = Math.ceil(filteredProducts.length / state.itemsPerPage) || 1;

    if (state.currentPage > totalPages || state.currentPage < 1) {
        showErrorPage(`Page ${state.currentPage} does not exist in the ${getCategoryNameFromSlug(categorySlug)} category. There are only ${totalPages} pages.`);
        return;
    }

    const startIndex = (state.currentPage - 1) * state.itemsPerPage;
    const endIndex = startIndex + state.itemsPerPage;
    const paginatedProducts = filteredProducts.slice(startIndex, endIndex);

    if (prevPageBtn) {
        prevPageBtn.disabled = state.currentPage === 1;
        prevPageBtn.onclick = () => {
            const tempPage = state.currentPage;
            if (tempPage > 1) {
                renderProducts(categorySlug, tempPage - 1);
                if (window.updateUrlState) window.updateUrlState(categorySlug, tempPage - 1);
                // When explicitly clicking pagination, we want to scroll to the top of the products
                window.scrollTo({ top: shopSection ? shopSection.offsetTop - 100 : 0, behavior: 'smooth' });
            }
        };
    }
    if (nextPageBtn) {
        nextPageBtn.disabled = state.currentPage === totalPages;
        nextPageBtn.onclick = () => {
            const tempPage = state.currentPage;
            if (tempPage < totalPages) {
                renderProducts(categorySlug, tempPage + 1);
                if (window.updateUrlState) window.updateUrlState(categorySlug, tempPage + 1);
                // When explicitly clicking pagination, we want to scroll to the top of the products
                window.scrollTo({ top: shopSection ? shopSection.offsetTop - 100 : 0, behavior: 'smooth' });
            }
        };
    }
    if (pageIndicator) {
        pageIndicator.textContent = `Page ${state.currentPage} of ${totalPages}`;
    }

    // Restore scroll position if provided, otherwise default to top of shop section for NEW page loads
    if (targetScroll !== null) {
        window.scrollTo({ top: targetScroll, behavior: 'instant' });
    } else if (page > 1) {
        // Only auto-scroll to top if we are specifically switching pages within the same category
        // without a specific target scroll (handled by pagination buttons)
    }

    paginatedProducts.forEach((product, index) => {
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

        if (state.isAdmin) {
            adminStockView = `<div style="font-size: 0.8rem; color: var(--primary); font-weight: bold; margin-bottom: 0.25rem;">(Stock: ${product.stock !== undefined ? product.stock : '∞'})</div>`;
        }

        if (product.stock === 0) {
            stockBadge = `<div style="position: absolute; top: 50%; left: 50%; transform: translate(-50%, -50%); background: rgba(0,0,0,0.7); color: white; padding: 0.5rem 1rem; border-radius: var(--radius-sm); font-weight: bold; z-index: 10; letter-spacing: 1px; white-space: nowrap;">OUT OF STOCK</div>`;
            cartButtonDisabled = 'disabled style="opacity: 0.5; cursor: not-allowed;"';
        } else if (product.stock > 0 && product.stock < 3) {
            stockBadge = `<div style="position: absolute; bottom: 8px; left: 8px; background: #ff9800; color: white; padding: 0.25rem 0.5rem; border-radius: 4px; font-size: 0.75rem; font-weight: bold; z-index: 10;">Low on stock</div>`;
        }

        let adminActions = '';
        if (state.isAdmin) {
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
        card.className = 'product-card category-slide-in';
        card.style.animationDelay = `${index * 0.05}s`;
        const imgSrc = getAbsoluteImageUrl(product.image);
        const imgDisplay = product.image ? `<img src="${imgSrc}" alt="${product.name}" class="product-img" loading="lazy">` : `<div class="product-img" style="display:flex; align-items:center; justify-content:center; background:#eee; color:#aaa; height: 200px; width: 100%;">No Image</div>`;

        card.innerHTML = `
            ${adminActions}
            <div onclick="${state.isAdmin ? '' : `window.renderProductPage('${product.slug}')`}" style="cursor: ${state.isAdmin ? 'default' : 'pointer'}; display: flex; flex-direction: column; flex-grow: 1;">
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
                ${!state.isAdmin ? `<button class="add-to-cart" onclick="window.addCartItem('${product.id}')" aria-label="Add to cart" ${cartButtonDisabled}>
                    <span class="material-icons-round">add_shopping_cart</span>
                </button>` : ''}
            </div>
        `;
        productGrid.appendChild(card);
    });
}
window.renderProducts = renderProducts;

// --- Product View Engine ---
let pvCurrentQty = 1;

export function renderProductPage(productSlug) {
    const product = state.inventory.find(p => p.slug === productSlug);
    if (!product) {
        showErrorPage(`Product could not be found.`);
        return;
    }

    window.currentViewedProduct = product;
    pvCurrentQty = 1;

    if (shopSection) shopSection.style.display = 'none';
    const trackView = document.getElementById('track-view');
    if (trackView) trackView.style.display = 'none';
    if (productViewSection) productViewSection.style.display = 'block';
    const errorViewSection = document.getElementById('error-view');
    if (errorViewSection) errorViewSection.style.display = 'none';

    if (pvCategory) pvCategory.textContent = getCategoryNameFromSlug(product.categoryId);
    if (pvTitle) pvTitle.textContent = product.name;
    if (pvDescription) pvDescription.textContent = product.description || 'No description available.';

    const currentPrice = product.offerPrice || product.price;
    if (pvPrice) pvPrice.textContent = `৳${currentPrice.toFixed(2)}`;

    const allImages = (product.images && product.images.length > 0) ? product.images : (product.image ? [product.image] : ['assets/placeholder.jpg']);
    if (pvMainImage) pvMainImage.src = getAbsoluteImageUrl(allImages[0]);
    if (pvThumbnails) pvThumbnails.innerHTML = '';

    allImages.forEach((imgUrl, idx) => {
        const thumb = document.createElement('img');
        thumb.src = getAbsoluteImageUrl(imgUrl);
        if (idx === 0) thumb.classList.add('active');
        thumb.onclick = () => {
            if (pvMainImage) pvMainImage.src = thumb.src;
            pvThumbnails.querySelectorAll('img').forEach(img => img.classList.remove('active'));
            thumb.classList.add('active');
        };
        if (pvThumbnails) pvThumbnails.appendChild(thumb);
    });

    if (pvQty) pvQty.textContent = '1';
    if (pvAddToCart) {
        pvAddToCart.disabled = false;
        pvAddToCart.style.opacity = '1';
        if (product.stock === 0) {
            if (pvStockStatus) {
                pvStockStatus.textContent = 'Out of Stock';
                pvStockStatus.style.color = '#ff4444';
            }
            pvAddToCart.disabled = true;
            pvAddToCart.style.opacity = '0.5';
        } else if (product.stock > 0 && product.stock <= 3) {
            if (pvStockStatus) {
                pvStockStatus.textContent = `Only ${product.stock} left`;
                pvStockStatus.style.color = '#ff9800';
            }
        } else {
            if (pvStockStatus) {
                pvStockStatus.textContent = 'In Stock';
                pvStockStatus.style.color = 'var(--text-muted)';
            }
        }
    }

    if (state.isAdmin) {
        if (pvAdminActions) pvAdminActions.style.display = 'block';
        if (pvAdminEdit) pvAdminEdit.onclick = () => {
            if (window.openEditModal) window.openEditModal(product.id);
        };
    } else {
        if (pvAdminActions) pvAdminActions.style.display = 'none';
    }

    const route = `${product.categorySlug}/page-${state.currentPage}/${product.slug}`;
    if (!window.location.pathname.endsWith(route)) {
        if (window.updateUrlState) window.updateUrlState(product.categorySlug, state.currentPage, product.slug);
    }

    window.scrollTo({ top: 0, behavior: 'smooth' });
}
window.renderProductPage = renderProductPage;

export function setupShopListeners() {
    // Sort dropdown listener
    const sortSelect = document.getElementById('sort-select');
    if (sortSelect) {
        sortSelect.addEventListener('change', (e) => {
            state.currentSort = e.target.value;
            state.currentPage = 1;
            renderProducts(state.currentCategorySlug, 1);
            if (window.updateUrlState) window.updateUrlState(state.currentCategorySlug, 1);
        });
    }

    // Scroll listener to save scroll position to memory
    let scrollTimeout;
    window.addEventListener('scroll', () => {
        if (!state.currentCategorySlug || (shopSection && shopSection.style.display === 'none')) return;
        
        // Throttle saving
        if (scrollTimeout) clearTimeout(scrollTimeout);
        scrollTimeout = setTimeout(() => {
            if (!state.categoryMemory) state.categoryMemory = {};
            if (!state.categoryMemory[state.currentCategorySlug]) {
                state.categoryMemory[state.currentCategorySlug] = { page: state.currentPage, scroll: 0 };
            }
            state.categoryMemory[state.currentCategorySlug].scroll = window.scrollY;
            state.categoryMemory[state.currentCategorySlug].page = state.currentPage;
        }, 200);
    }, { passive: true });

    // --- Floating category tabs on scroll (portal/clone pattern — no glitches) ---
    // Trick: the original tabs NEVER change position type.
    // A separate fixed clone slides in/out via translateY only.
    if (categoryTabsContainer) {
        // Create the always-fixed clone element
        let clone = document.getElementById('category-tabs-clone');
        if (!clone) {
            clone = document.createElement('div');
            clone.id = 'category-tabs-clone';
            clone.className = 'category-tabs category-tabs-clone';
            document.body.appendChild(clone);
        }

        // Copy inner HTML from real tabs + wire up click delegation
        const syncClone = () => {
            clone.innerHTML = categoryTabsContainer.innerHTML;
            clone.querySelectorAll('.tab-btn').forEach((btn, i) => {
                btn.addEventListener('click', (e) => {
                    e.stopPropagation();
                    const real = categoryTabsContainer.querySelectorAll('.tab-btn')[i];
                    if (real) real.click();
                });
                // Remove any delete/admin buttons from clone
                btn.querySelectorAll('.delete-category-btn').forEach(d => d.remove());
            });
        };
        setTimeout(syncClone, 300);
        window._syncFloatingClone = syncClone;

        let isFloating = false;
        let ticking = false;

        const updateFloat = () => {
            // Only show floating clone on the main product grid page
            const pvSection = document.getElementById('product-view');
            const checkoutViewSection = document.getElementById('checkout-view');
            const adminOrdersViewSection = document.getElementById('admin-orders-view');
            const isOnMainGrid = shopSection
                && shopSection.style.display !== 'none'
                && (!pvSection || pvSection.style.display === 'none')
                && (!checkoutViewSection || checkoutViewSection.style.display === 'none')
                && (!adminOrdersViewSection || adminOrdersViewSection.style.display === 'none');

            if (!isOnMainGrid) {
                if (isFloating) {
                    isFloating = false;
                    clone.classList.remove('clone-visible');
                }
                return;
            }

            const rect = categoryTabsContainer.getBoundingClientRect();
            const pastTabs = rect.bottom < 80; // tabs scrolled above viewport

            if (pastTabs && !isFloating) {
                isFloating = true;
                syncClone();
                clone.classList.add('clone-visible');
            } else if (!pastTabs && isFloating) {
                isFloating = false;
                clone.classList.remove('clone-visible');
            }
        };

        window.addEventListener('scroll', () => {
            if (!ticking) {
                ticking = true;
                requestAnimationFrame(() => { updateFloat(); ticking = false; });
            }
        }, { passive: true });
    }
    if (backToShopBtn) {
        backToShopBtn.addEventListener('click', () => {
            if (productViewSection) productViewSection.style.display = 'none';
            const trackView = document.getElementById('track-view');
            if (trackView) trackView.style.display = 'none';
            if (shopSection) shopSection.style.display = 'block';
            const errorViewSection = document.getElementById('error-view');
            if (errorViewSection) errorViewSection.style.display = 'none';
            if (state.currentCategorySlug && window.updateUrlState) {
                window.updateUrlState(state.currentCategorySlug);
            }
        });
    }

    pvQtyInc?.addEventListener('click', () => {
        if (window.currentViewedProduct && window.currentViewedProduct.stock !== undefined && pvCurrentQty >= window.currentViewedProduct.stock) {
            alert(`Only ${window.currentViewedProduct.stock} units available.`);
            return;
        }
        pvCurrentQty++;
        if (pvQty) pvQty.textContent = pvCurrentQty;
    });

    pvQtyDec?.addEventListener('click', () => {
        if (pvCurrentQty > 1) {
            pvCurrentQty--;
            if (pvQty) pvQty.textContent = pvCurrentQty;
        }
    });

    pvAddToCart?.addEventListener('click', () => {
        if (!window.currentViewedProduct) return;
        for (let i = 0; i < pvCurrentQty; i++) {
            if (window.addCartItem) window.addCartItem(window.currentViewedProduct.id);
        }
        alert(`Added ${pvCurrentQty} item(s) to your cart.`);
        pvCurrentQty = 1;
        if (pvQty) pvQty.textContent = pvCurrentQty;
    });

    pvMainImage?.parentElement.addEventListener('click', () => {
        if (expandedImage) expandedImage.src = pvMainImage.src;
        if (imageExpanderModal) imageExpanderModal.style.display = 'flex';
    });

    closeImageExpander?.addEventListener('click', () => {
        if (imageExpanderModal) imageExpanderModal.style.display = 'none';
    });
}
