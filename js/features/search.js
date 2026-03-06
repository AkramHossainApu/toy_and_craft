import { state } from '../core/state.js';
import { getAbsoluteImageUrl } from '../core/utils.js';
import { updateUrlState } from './router.js';

// --- Smart Search Engine ---

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

function scoreProduct(product, query) {
    const q = query.toLowerCase().trim();
    if (!q) return 0;

    const name = (product.name || '').toLowerCase();
    const category = (product.categoryId || '').toLowerCase();
    const description = (product.description || '').toLowerCase();

    let score = 0;

    // Exact match boost
    if (name === q) return 100;

    // Starts-with boost
    if (name.startsWith(q)) score += 60;

    // Contains boost — only on word boundaries for short queries
    if (q.length <= 4) {
        // For short queries, require word-boundary match
        const nameWords = name.split(/\s+/);
        const hasWordMatch = nameWords.some(w => w.startsWith(q));
        if (hasWordMatch) score += 45;
        else if (name.includes(q)) score += 15; // weaker score for mid-word match
    } else {
        if (name.includes(q)) score += 40;
    }

    // Word-level matching
    const nameWords = name.split(/\s+/);
    for (const word of nameWords) {
        if (word.startsWith(q)) { score += 35; break; }
    }

    // Category match
    if (category.includes(q)) score += 20;

    // Description match (only for longer queries)
    if (q.length > 3 && description.includes(q)) score += 10;

    // Trigram similarity — reduce weight for short queries to avoid false positives
    if (q.length > 4) {
        const trigramScore = trigramSimilarity(q, name);
        score += trigramScore * 30;
    }

    // Levenshtein distance for short queries — be stricter
    if (q.length >= 3 && q.length < 8) {
        for (const word of nameWords) {
            const compareLen = Math.min(word.length, q.length + 1);
            const dist = levenshtein(q, word.substring(0, compareLen));
            // Only allow distance 1 for short queries, distance 2 for longer
            const maxDist = q.length <= 4 ? 1 : 2;
            if (dist <= maxDist) {
                score += (maxDist + 1 - dist) * 10;
            }
        }
    }

    // Multi-word query: check if all words appear somewhere
    const queryWords = q.split(/\s+/);
    if (queryWords.length > 1) {
        const fullText = `${name} ${category} ${description}`;
        const allMatch = queryWords.every(w => fullText.includes(w));
        if (allMatch) score += 25;
    }

    return score;
}

export function smartSearch(query, limit = 50) {
    if (!query || !query.trim()) return [];

    const scored = state.inventory
        .map(product => ({ product, score: scoreProduct(product, query) }))
        .filter(item => item.score > 5)
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

        const imgSrc = getAbsoluteImageUrl(product.image);
        const imgDisplay = product.image
            ? `<img src="${imgSrc}" alt="${product.name}" class="product-img" loading="lazy">`
            : `<div class="product-img" style="display:flex; align-items:center; justify-content:center; background:#eee; color:#aaa; height: 200px; width: 100%;">No Image</div>`;

        const card = document.createElement('div');
        card.className = 'product-card category-slide-in';
        card.style.animationDelay = `${index * 0.04}s`;

        card.innerHTML = `
            <div onclick="window.renderProductPage('${product.slug}')" style="cursor: pointer; display: flex; flex-direction: column; flex-grow: 1;">
                <div class="product-img-wrap" style="position: relative;">
                    ${badges}
                    ${stockBadge}
                    ${imgDisplay}
                </div>
                <div class="product-info">
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

function updateSearchUrl(keyword) {
    let baseUri = '/';
    if (window.location.pathname.startsWith('/toy_and_craft')) {
        baseUri = '/toy_and_craft/';
    }

    let newPath;
    if (state.currentUser) {
        newPath = `${state.currentUser.id}/search/${encodeURIComponent(keyword)}`;
    } else {
        newPath = `search/${encodeURIComponent(keyword)}`;
    }

    try {
        window.history.replaceState({ path: baseUri + newPath }, '', baseUri + newPath);
    } catch (e) {
        console.warn('Search URL update failed', e);
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

export function setupSearchListeners() {
    const searchInput = document.getElementById('search-input');
    const clearBtn = document.getElementById('search-clear-btn');
    const searchWrap = document.getElementById('inline-search-wrap');

    if (!searchInput) return;

    searchInput.addEventListener('input', () => {
        clearTimeout(debounceTimer);
        const query = searchInput.value.trim();

        if (clearBtn) clearBtn.style.display = query ? 'flex' : 'none';
        if (searchWrap) searchWrap.classList.toggle('active', !!query);

        if (!query) {
            if (isSearchActive) {
                exitSearch();
            }
            return;
        }

        debounceTimer = setTimeout(() => {
            isSearchActive = true;
            const results = smartSearch(query);
            renderSearchResultsInGrid(results);
            updateSearchUrl(query);
        }, 200);
    });

    searchInput.addEventListener('keydown', (e) => {
        if (e.key === 'Escape') {
            exitSearch();
            searchInput.blur();
        }
    });

    if (clearBtn) {
        clearBtn.addEventListener('click', () => {
            exitSearch();
        });
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
