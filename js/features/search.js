import { state } from '../core/state.js';
import { getAbsoluteImageUrl } from '../core/utils.js';
import { updateUrlState } from './router.js';

// --- Smart Search Engine ---
let model = null;
let isModelLoading = false;

// Trigram generator for fuzzy matching
function getTrigrams(str) {
    const s = `  ${str.toLowerCase()}  `;
    const trigrams = new Set();
    for (let i = 0; i < s.length - 2; i++) {
        trigrams.add(s.substring(i, i + 3));
    }
    return trigrams;
}

function trigramSimilarity(a, b) {
    const trigramsA = getTrigrams(a);
    const trigramsB = getTrigrams(b);
    let intersection = 0;
    trigramsA.forEach(t => { if (trigramsB.has(t)) intersection++; });
    const union = trigramsA.size + trigramsB.size - intersection;
    return union === 0 ? 0 : intersection / union;
}

// Levenshtein distance for short strings
function levenshtein(a, b) {
    const m = a.length, n = b.length;
    if (m === 0) return n;
    if (n === 0) return m;
    const dp = Array.from({ length: m + 1 }, () => Array(n + 1).fill(0));
    for (let i = 0; i <= m; i++) dp[i][0] = i;
    for (let j = 0; j <= n; j++) dp[0][j] = j;
    for (let i = 1; i <= m; i++) {
        for (let j = 1; j <= n; j++) {
            dp[i][j] = Math.min(
                dp[i - 1][j] + 1,
                dp[i][j - 1] + 1,
                dp[i - 1][j - 1] + (a[i - 1] === b[j - 1] ? 0 : 1)
            );
        }
    }
    return dp[m][n];
}

// AI Synonym Map for MobileNet (Commonly mislabeled toy types)
const AI_SYNONYMS = {
    'jigsaw puzzle': ['mini bricks', 'lego', 'bricks', 'puzzle', 'toy', 'building blocks'],
    'crossword puzzle': ['mini bricks', 'bricks', 'box', 'toy'],
    'plastic model': ['mini bricks', 'model', 'toy', 'figure'],
    'teddy': ['key ring', 'plush', 'toy', 'soft toy'],
    'soft-coated wheaten terrier': ['key ring', 'plush', 'toy'],
    'dalmatian': ['key ring', 'toy', 'figure'],
    'lego': ['mini bricks', 'bricks', 'building blocks'],
    'toyshop': ['toy', 'bricks', 'gift'],
    'building block': ['mini bricks', 'bricks', 'lego'],
    'mask': ['mini bricks', 'figure', 'character'],
    'doll': ['figure', 'character', 'toy'],
    'miniature': ['mini bricks', 'key ring', 'mini'],
    'puck': ['key ring', 'round'],
    'switch': ['mini bricks', 'lego', 'bricks', 'toy', 'building blocks', 'kuromi', 'sanrio'],
    'television': ['mini bricks', 'bricks', 'box', 'toy'],
    'monitor': ['mini bricks', 'bricks', 'box', 'toy'],
    'handheld computer': ['mini bricks', 'toy', 'game'],
    'joystick': ['key ring', 'toy'],
    'pot, flowerpot': ['mini bricks', 'bricks', 'flower', 'vase', 'florist', 'botanical'],
    'rose': ['mini bricks', 'bricks', 'flower', 'rose', 'floral', 'hibiscus'],
    'vase': ['mini bricks', 'bricks', 'flower', 'vase', 'florist'],
    'daisy': ['mini bricks', 'bricks', 'flower', 'floral'],
    'hibiscus': ['mini bricks', 'bricks', 'flower', 'hibiscus', 'floral'],
    'potted plant': ['mini bricks', 'bricks', 'flower', 'vase', 'botanical'],
    'wildflower': ['mini bricks', 'bricks', 'flower', 'floral', 'wildflower'],
    'petal': ['mini bricks', 'flower', 'floral', 'petall'],
    'leaf': ['mini bricks', 'flower', 'floral'],
    'pedicel': ['mini bricks', 'flower', 'botanical'],
    'stigma': ['mini bricks', 'flower', 'botanical'],
    'monocot': ['mini bricks', 'flower', 'floral'],
    'lupine': ['mini bricks', 'flower', 'floral'],
    'envelope': ['mini bricks', 'bricks', 'box', 'packet'],
    'packet': ['mini bricks', 'bricks', 'box', 'toy'],
    'carton': ['mini bricks', 'bricks', 'box', 'toy'],
    'shopping bag': ['mini bricks', 'bricks', 'toy']
};

function scoreProduct(product, query, aiLabels = []) {
    const q = query ? query.toLowerCase().trim() : '';
    
    const name = (product.name || '').toLowerCase();
    const categoryId = (product.categoryId || '').toLowerCase();
    const categoryLabel = categoryId.replace(/_/g, ' ');
    const description = (product.description || '').toLowerCase();
    const nameWords = name.split(/\s+/);

    let score = 0;

    // ── AI Label Match (Visual Search) ──
    if (aiLabels.length > 0) {
        aiLabels.forEach((labelObj, index) => {
            const rawLabel = labelObj.className.toLowerCase();
            const prob = labelObj.probability;
            const labelsToTest = [rawLabel];
            Object.keys(AI_SYNONYMS).forEach(key => {
                if (rawLabel.includes(key)) labelsToTest.push(...AI_SYNONYMS[key]);
            });
            labelsToTest.forEach(label => {
                if (name.includes(label) || categoryLabel.includes(label) || description.includes(label)) {
                    score += (prob * 120) * (index === 0 ? 1.5 : 1);
                }
                const similarity = trigramSimilarity(label, name);
                if (similarity > 0.2) score += (similarity * 80) * (index === 0 ? 1.2 : 1);
                if (['bricks', 'puzzle', 'lego', 'botanical'].includes(label) && categoryId === 'mini_bricks') score += 25 * prob;
                if (['flower', 'rose', 'floral', 'florist'].includes(label)) {
                    if (categoryId === 'mini_bricks') score += 30 * prob;
                    if (name.includes('flower') || name.includes('florist')) score += 40 * prob;
                }
                if (['plush', 'teddy', 'toy'].includes(label) && categoryId === 'key_rings') score += 15 * prob;
            });
        });
        if (score > 10) console.log(`Matched Product: ${product.name} | AI Score: ${score.toFixed(2)}`);
    }

    if (!q) return score;

    // ══════════════════════════════════════════════════
    // TIERED SCORING — exact matches always rank first
    // ══════════════════════════════════════════════════

    // ── TIER 1: Exact full-name match (highest priority) ──
    if (name === q) {
        score += 10000;
    }

    // ── TIER 2: Name starts with query ──
    if (name.startsWith(q + ' ') || name.startsWith(q) && name.length === q.length) {
        score += 5000;
    } else if (name.startsWith(q)) {
        score += 4000;
    }

    // ── TIER 3: A word in the name starts with the query (word-boundary match) ──
    const hasWordStartMatch = nameWords.some(w => w === q);
    const hasWordPrefixMatch = nameWords.some(w => w.startsWith(q));

    if (hasWordStartMatch) {
        score += 3000; // Exact word match within name
    } else if (hasWordPrefixMatch) {
        score += 2000; // Word prefix match
    }

    // ── TIER 4: Name contains the query as a substring ──
    if (name.includes(q) && score < 2000) {
        score += 1000;
    }

    // ── TIER 5: Category match ──
    if (categoryLabel === q) {
        score += 800;
    } else if (categoryLabel.includes(q)) {
        score += 500;
    }

    // ── TIER 6: Description match (longer queries only) ──
    if (q.length > 2 && description.includes(q)) {
        score += 200;
    }

    // ── TIER 7: Multi-word query — all words appear somewhere ──
    const queryWords = q.split(/\s+/);
    if (queryWords.length > 1) {
        const fullText = `${name} ${categoryLabel} ${description}`;
        const allMatch = queryWords.every(w => fullText.includes(w));
        if (allMatch) score += 1500;

        // Partial multi-word: count how many words match
        const matchCount = queryWords.filter(w => fullText.includes(w)).length;
        if (matchCount > 0 && !allMatch) {
            score += (matchCount / queryWords.length) * 400;
        }
    }

    // ── TIER 8: Fuzzy matching (only if no strong match found above) ──
    if (score < 500) {
        // Trigram similarity for longer queries
        if (q.length > 4) {
            const trigramScore = trigramSimilarity(q, name);
            if (trigramScore > 0.25) {
                score += trigramScore * 80;
            }
        }

        // Levenshtein distance for typo tolerance
        if (q.length >= 3 && q.length < 10) {
            for (const word of nameWords) {
                const compareLen = Math.min(word.length, q.length + 2);
                const dist = levenshtein(q, word.substring(0, compareLen));
                const maxDist = q.length <= 4 ? 1 : 2;
                if (dist <= maxDist) {
                    score += ((maxDist + 1 - dist) * 30);
                    break; // Only count best match
                }
            }
        }

        // Also try trigram on individual words for very fuzzy matching
        if (q.length > 3) {
            for (const word of nameWords) {
                const sim = trigramSimilarity(q, word);
                if (sim > 0.4) {
                    score += sim * 50;
                    break;
                }
            }
        }
    }

    return score;
}

export function smartSearch(query, limit = 50, aiLabels = []) {
    if ((!query || !query.trim()) && aiLabels.length === 0) return [];

    const minScore = aiLabels.length > 0 ? 3 : 10;

    const scored = state.inventory
        .map(product => ({ product, score: scoreProduct(product, query, aiLabels) }))
        .filter(item => item.score > minScore)
        .sort((a, b) => b.score - a.score)
        .slice(0, limit);

    return scored.map(item => item.product);
}

// --- Inline Search UI ---

let debounceTimer = null;
let isSearchActive = false;

function renderSearchResultsInGrid(results) {
    const productGrid = document.getElementById('product-grid');
    const paginationControls = document.getElementById('pagination-controls');
    if (!productGrid) return;

    productGrid.innerHTML = '';

    if (paginationControls) paginationControls.style.display = 'none';

    // Deactivate all category tabs visually
    const categoryTabs = document.querySelector('.category-tabs');
    if (categoryTabs) {
        categoryTabs.querySelectorAll('.tab-btn').forEach(b => b.classList.remove('active'));
        // Hide tab slider
        const slider = categoryTabs.querySelector('.tab-slider');
        if (slider) slider.style.opacity = '0';
    }

    if (results.length === 0) {
        productGrid.innerHTML = `
            <div style="grid-column: 1/-1; text-align: center; padding: 3rem; color: var(--text-muted);">
                <span class="material-icons-round" style="font-size: 48px; margin-bottom: 1rem; display: block; opacity: 0.5;">search_off</span>
                <p style="font-size: 1.1rem; margin-bottom: 0.5rem;">No products found</p>
                <p style="font-size: 0.9rem;">Try a different search term or check the spelling.</p>
            </div>
        `;
        return;
    }

    // Show search results count
    const countBanner = document.createElement('div');
    countBanner.style.cssText = 'grid-column: 1/-1; padding: 0.5rem 0; color: var(--text-muted); font-size: 0.9rem; display: flex; align-items: center; gap: 0.5rem;';
    countBanner.innerHTML = `<span class="material-icons-round" style="font-size: 18px;">search</span> Found ${results.length} product${results.length !== 1 ? 's' : ''}`;
    productGrid.appendChild(countBanner);

    results.forEach((product, index) => {
        const hasOffer = product.offerPrice !== null && product.offerPrice > 0;
        const priceDisplay = hasOffer ?
            `<span class="product-price">৳${product.offerPrice.toFixed(2)}</span><span class="price-strike">৳${product.price.toFixed(2)}</span>` :
            `<span class="product-price">৳${product.price.toFixed(2)}</span>`;

        let badges = '';
        if (product.isSale) badges += `<div class="product-badge badge-sale">SALE</div>`;
        else if (product.isNew) badges += `<div class="product-badge badge-new">NEW</div>`;

        let stockBadge = '';
        let cartButtonDisabled = '';

        if (product.stock === 0) {
            stockBadge = `<div style="position: absolute; top: 50%; left: 50%; transform: translate(-50%, -50%); background: rgba(0,0,0,0.7); color: white; padding: 0.5rem 1rem; border-radius: var(--radius-sm); font-weight: bold; z-index: 10; letter-spacing: 1px; white-space: nowrap;">OUT OF STOCK</div>`;
            cartButtonDisabled = 'disabled style="opacity: 0.5; cursor: not-allowed;"';
        } else if (product.stock > 0 && product.stock < 3) {
            stockBadge = `<div style="position: absolute; bottom: 8px; left: 8px; background: #ff9800; color: white; padding: 0.25rem 0.5rem; border-radius: 4px; font-size: 0.75rem; font-weight: bold; z-index: 10;">Low on stock</div>`;
        }

        let adminActions = '';
        let adminStockView = '';
        if (state.isAdmin) {
            adminStockView = `<div style="font-size: 0.8rem; color: var(--primary); font-weight: bold; margin-bottom: 0.25rem;">(Stock: ${product.stock !== undefined ? product.stock : '∞'})</div>`;
            adminActions = `
                <button class="edit-product-btn" onclick="window.openEditModal('${product.id}')" title="Edit Product">
                    <span class="material-icons-round">edit</span>
                </button>
                <button class="delete-product-btn" onclick="window.deleteProduct('${product.categoryId}', '${product.id}')" title="Delete Product">
                    <span class="material-icons-round">delete</span>
                </button>
            `;
        }

        const imgSrc = getAbsoluteImageUrl(product.image);
        const imgDisplay = product.image
            ? `<img src="${imgSrc}" alt="${product.name}" class="product-img" loading="lazy">`
            : `<div class="product-img" style="display:flex; align-items:center; justify-content:center; background:#eee; color:#aaa; height: 200px; width: 100%;">No Image</div>`;

        const card = document.createElement('div');
        card.className = 'product-card category-slide-in';
        card.style.animationDelay = `${index * 0.04}s`;

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

function updateSearchUrl(keyword) {
    let baseUri = '/';
    if (window.location.pathname.startsWith('/toy_and_craft')) {
        baseUri = '/toy_and_craft/';
    }

    let userPath = 'guest';
    if (state.isAdmin) userPath = 'admin';
    else if (state.currentUser) userPath = state.currentUser.id;

    const newPath = `${userPath}/search/${encodeURIComponent(keyword)}`;

    try {
        window.history.replaceState({ path: baseUri + newPath }, '', baseUri + newPath);
    } catch (e) {
        console.warn('Search URL update failed', e);
    }
}

function updateImageSearchUrl(fileName) {
    let baseUri = '/';
    if (window.location.pathname.startsWith('/toy_and_craft')) {
        baseUri = '/toy_and_craft/';
    }

    let userPath = 'guest';
    if (state.isAdmin) userPath = 'admin';
    else if (state.currentUser) userPath = state.currentUser.id;

    // url/userid/search/image/imagename
    const safeName = (fileName || 'image-upload').replace(/[^a-z0-9.]/gi, '-').toLowerCase();
    const newPath = `${userPath}/search/image/${safeName}`;

    try {
        window.history.replaceState({ path: baseUri + newPath }, '', baseUri + newPath);
    } catch (e) {
        console.warn('Image search URL update failed', e);
    }
}

function exitSearch() {
    isSearchActive = false;
    const searchInput = document.getElementById('search-input');
    const clearBtn = document.getElementById('search-clear-btn');
    const paginationControls = document.getElementById('pagination-controls');
    const searchWrap = document.getElementById('inline-search-wrap');

    if (searchInput) searchInput.value = '';
    if (clearBtn) clearBtn.style.display = 'none';
    if (paginationControls) paginationControls.style.display = 'flex';
    if (searchWrap) searchWrap.classList.remove('active');

    // Restore the tab slider
    const categoryTabs = document.querySelector('.category-tabs');
    if (categoryTabs) {
        const slider = categoryTabs.querySelector('.tab-slider');
        if (slider) slider.style.opacity = '1';
    }

    // Re-render the current category's products and restore URL
    if (window.renderCategoryTabs) window.renderCategoryTabs();
    if (window.renderProducts) window.renderProducts(state.currentCategorySlug, state.currentPage || 1);
    updateUrlState(state.currentCategorySlug, state.currentPage || 1);
}

// --- Visual Search Logic ---

async function loadAIModel() {
    if (model) return model;
    if (isModelLoading) return null;
    
    isModelLoading = true;
    const btn = document.getElementById('visual-search-btn');
    if (btn) btn.classList.add('loading');

    try {
        // @ts-ignore - MobileNet and TF are loaded via CDN in index.html
        if (typeof mobilenet !== 'undefined') {
            model = await mobilenet.load();
            console.log("AI Search Model Loaded");
        }
    } catch (e) {
        console.error("Failed to load AI model", e);
    } finally {
        isModelLoading = false;
        if (btn) btn.classList.remove('loading');
    }
    return model;
}

async function processImageForSearch(fileOrBlob) {
    const overlay = document.getElementById('visual-search-overlay');
    const preview = document.getElementById('scanning-preview');
    const searchInput = document.getElementById('search-input');
    
    if (!overlay || !preview) return;

    // Capture file name if available
    const fileName = (fileOrBlob instanceof File) ? fileOrBlob.name : 'pasted-image.png';

    // Show processing UI
    const reader = new FileReader();
    reader.onload = async (e) => {
        preview.src = e.target.result;
        overlay.style.display = 'flex';

        // Load model if not ready
        const readyModel = await loadAIModel();
        if (!readyModel) {
            overlay.style.display = 'none';
            alert("AI service is temporarily unavailable. Please try again in a moment.");
            return;
        }

        // Create temporary image element for classification
        const img = new Image();
        img.src = e.target.result;
        img.onload = async () => {
            try {
                const predictions = await readyModel.classify(img);
                
                // Premium Debugging: Show the user/admin what the AI "saw"
                console.group("%c AI Visual Search Analysis ", "background: #007bff; color: white; padding: 2px 5px; border-radius: 3px; font-weight: bold;");
                console.table(predictions.map(p => ({
                    'Label': p.className,
                    'Probability': (p.probability * 100).toFixed(2) + '%',
                })));
                console.groupEnd();

                // Perform Search
                isSearchActive = true;
                const results = smartSearch('', 50, predictions);
                
                // Close UI and render
                setTimeout(() => {
                    overlay.style.display = 'none';
                    renderSearchResultsInGrid(results);
                    
                    if (searchInput) {
                        // Better feedback: if matched switch/bricks, show "Visual Match: [Label]"
                        const topLabel = predictions[0].className.split(',')[0];
                        searchInput.value = `Visual Search: ${topLabel}`;
                        
                        const searchWrap = document.getElementById('inline-search-wrap');
                        if (searchWrap) searchWrap.classList.add('active');
                        const clearBtn = document.getElementById('search-clear-btn');
                        if (clearBtn) clearBtn.style.display = 'flex';
                    }

                    // url/userid/search/image/imagename
                    updateImageSearchUrl(fileName);

                }, 1000); // Small delay for UX feel
            } catch (err) {
                console.error("Classification failed", err);
                overlay.style.display = 'none';
            }
        };
    };
    
    if (fileOrBlob instanceof Blob) {
        reader.readAsDataURL(fileOrBlob);
    }
}

export function setupSearchListeners() {
    const searchInput = document.getElementById('search-input');
    const clearBtn = document.getElementById('search-clear-btn');
    const searchWrap = document.getElementById('inline-search-wrap');
    const visualBtn = document.getElementById('visual-search-btn');
    const visualInput = document.getElementById('visual-search-input');

    if (!searchInput) return;

    // Main text search
    searchInput.addEventListener('input', (e) => {
        clearTimeout(debounceTimer);
        const query = searchInput.value.trim();

        if (clearBtn) clearBtn.style.display = query ? 'flex' : 'none';
        if (searchWrap) searchWrap.classList.toggle('active', !!query);

        if (!query) {
            if (isSearchActive) exitSearch();
            return;
        }

        debounceTimer = setTimeout(() => {
            try {
                isSearchActive = true;
                const results = smartSearch(query);
                renderSearchResultsInGrid(results);
                updateSearchUrl(query);
            } catch (err) {
                console.error("Real-time search failed", err);
            }
        }, 150); // Snappier 150ms debounce
    });

    // Clipboard Paste Support (images + text)
    searchInput.addEventListener('paste', (e) => {
        let hasImage = false;
        const items = e.clipboardData.items;
        for (let i = 0; i < items.length; i++) {
            if (items[i].type.indexOf('image') !== -1) {
                hasImage = true;
                const blob = items[i].getAsFile();
                processImageForSearch(blob);
                break;
            }
        }

        // For text paste: explicitly trigger search after value updates
        if (!hasImage) {
            setTimeout(() => {
                const query = searchInput.value.trim();
                if (clearBtn) clearBtn.style.display = query ? 'flex' : 'none';
                if (searchWrap) searchWrap.classList.toggle('active', !!query);
                if (!query) {
                    if (isSearchActive) exitSearch();
                    return;
                }
                clearTimeout(debounceTimer);
                try {
                    isSearchActive = true;
                    const results = smartSearch(query);
                    renderSearchResultsInGrid(results);
                    updateSearchUrl(query);
                } catch (err) {
                    console.error("Paste search failed", err);
                }
            }, 0); // microtask: runs after paste value is applied
        }
    });

    // Visual Search Click/Upload
    if (visualBtn && visualInput) {
        visualBtn.addEventListener('click', () => visualInput.click());
        visualInput.addEventListener('change', (e) => {
            if (e.target.files && e.target.files[0]) {
                processImageForSearch(e.target.files[0]);
                // Reset input so same file can be searched again
                visualInput.value = '';
            }
        });
    }

    searchInput.addEventListener('keydown', (e) => {
        if (e.key === 'Escape') {
            exitSearch();
            searchInput.blur();
        }
    });

    if (clearBtn) {
        clearBtn.addEventListener('click', () => exitSearch());
    }
}

// Called by router when a search URL is loaded
export function triggerSearchFromUrl(keyword) {
    const searchInput = document.getElementById('search-input');
    const clearBtn = document.getElementById('search-clear-btn');
    const searchWrap = document.getElementById('inline-search-wrap');

    if (!searchInput) return;

    searchInput.value = keyword;
    if (clearBtn) clearBtn.style.display = 'flex';
    if (searchWrap) searchWrap.classList.add('active');

    isSearchActive = true;
    const results = smartSearch(keyword);
    renderSearchResultsInGrid(results);
}
window.triggerSearchFromUrl = triggerSearchFromUrl;
