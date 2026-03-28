/**
 * Intelligent Chatbot Engine for Toy & Craft
 * Data-driven assistant with product search, invoice access, and rich UI
 */

import { state } from '../core/state.js';
import { db, collection, getDocs, getDoc, doc, query, where } from '../config/firebase.js';
import { getAbsoluteImageUrl } from '../core/utils.js';
import { trackByInvoice, getStatusDisplay } from '../config/steadfast.js';

export class Chatbot {
    constructor() {
        this.container = document.getElementById('chatbot-container');
        this.trigger = document.getElementById('chatbot-trigger');
        this.window = document.getElementById('chatbot-window');
        this.closeBtn = document.getElementById('close-chatbot');
        this.messagesContainer = document.getElementById('chatbot-messages');
        this.actionsContainer = document.getElementById('chatbot-actions');
        this.inputField = document.getElementById('chatbot-input-field');
        this.sendBtn = document.getElementById('send-chatbot-msg');
        this.firstMessageSent = false;
        
        // Storage for keyboard avoidance
        this.initialBaseHeight = 0;
        this.initialBaseTop = 0;

        this.init();
    }

    // ─── Helpers ──────────────────────────────────────────────────
    getBaseUrl() {
        return window.location.origin + (window.location.pathname.startsWith('/toy_and_craft') ? '/toy_and_craft/' : '/');
    }

    getUserPrefix() {
        return state.currentUser ? `${state.currentUser.id}/` : '';
    }

    getProductUrl(product) {
        const base = this.getBaseUrl();
        const prefix = this.getUserPrefix();
        const catProducts = state.inventory.filter(p => p.categorySlug === product.categorySlug);
        const idx = catProducts.findIndex(p => p.id === product.id);
        const page = Math.floor(idx / state.itemsPerPage) + 1;
        return `${base}${prefix}${product.categorySlug}/page-${page}/${product.slug}`;
    }

    getInvoiceUrl(orderId) {
        const base = this.getBaseUrl();
        if (state.currentUser) {
            return `${base}${state.currentUser.id}/Orders/${orderId}`;
        }
        return null;
    }

    isLoggedIn() {
        return !!state.currentUser;
    }

    getUserName() {
        return state.currentUser?.name || 'there';
    }

    // ─── Init ─────────────────────────────────────────────────────
    init() {
        if (!this.trigger || !this.window) return;

        this.trigger.addEventListener('click', () => this.toggle());
        this.closeBtn.addEventListener('click', () => this.close());

        this.actionsContainer.addEventListener('click', (e) => {
            if (e.target.classList.contains('action-btn')) {
                const action = e.target.dataset.action;
                const label = e.target.innerText;
                this.handleAction(action, label);
            }
        });

        this.sendBtn.addEventListener('click', () => this.handleSendMessage());
        this.inputField.addEventListener('keypress', (e) => {
            if (e.key === 'Enter') this.handleSendMessage();
        });

        // Mobile Viewport Handling (Keyboard Fix)
        if (window.visualViewport) {
            window.visualViewport.addEventListener('resize', () => this.handleViewportChange());
            window.visualViewport.addEventListener('scroll', () => this.handleViewportChange());
        }
    }

    toggle() {
        this.window.classList.toggle('active');
        if (this.window.classList.contains('active')) {
            // Hide cat buddy when chat is open
            if (window.catBuddy) window.catBuddy.hide();
            
            if (window.innerWidth <= 480) {
                document.body.classList.add('chat-open');
                // Capture initial state for floating keyboard avoidance
                setTimeout(() => {
                    const rect = this.window.getBoundingClientRect();
                    this.initialBaseTop = rect.top;
                    this.initialBaseHeight = rect.height;
                    this.handleViewportChange();
                }, 310); // Wait for open transition
            }
        } else {
            document.body.classList.remove('chat-open');
            this.window.style.height = '';
            this.window.style.bottom = '';
        }
    }

    close() {
        this.window.classList.remove('active');
        document.body.classList.remove('chat-open');
        this.window.style.height = '';
        this.window.style.bottom = '';
        // Cat can start acting again after close (next interval)
    }

    handleViewportChange() {
        if (!this.window.classList.contains('active') || window.innerWidth > 480) return;

        const vv = window.visualViewport;
        const layoutHeight = window.innerHeight;
        
        // keyboardHeight is technically the space below the visual viewport in the layout viewport
        const offsetFromBottom = layoutHeight - (vv.height + vv.offsetTop);
        const isKeyboardUp = offsetFromBottom > 30; // Threshold for keyboard detection

        if (isKeyboardUp) {
            const margin = 16;
            // Anchoring to the visual bottom ensures it stays above keyboard even if browser scrolls the background
            const targetBottom = offsetFromBottom + margin;
            
            // Available space depends on the visual viewport height
            // We want to keep the top stable relative to the LAYOUT viewport 
            // unless it gets too squashed
            const targetTop = this.initialBaseTop;
            const newHeight = Math.max(240, layoutHeight - targetBottom - targetTop); // Guaranteed 240px min height for "2 lines"
            
            this.window.style.bottom = `${targetBottom}px`;
            this.window.style.height = `${newHeight}px`;
            
            // Force scroll the messages to the bottom to see the latest text
            this.scrollToBottom();
        } else {
            // Keyboard is hidden
            this.window.style.bottom = ''; 
            this.window.style.height = ''; 
        }
    }

    // ─── Message Rendering ────────────────────────────────────────

    addMessage(text, side = 'bot') {
        const msgDiv = document.createElement('div');
        msgDiv.className = `chat-msg ${side}`;
        msgDiv.innerText = text;
        this.messagesContainer.appendChild(msgDiv);
        this.scrollToBottom();

        if (side === 'user' && !this.firstMessageSent) {
            this.firstMessageSent = true;
            this.hideActions();
        }
    }

    addRichMessage(html) {
        const msgDiv = document.createElement('div');
        msgDiv.className = 'chat-msg bot chat-rich';
        msgDiv.innerHTML = html;
        this.messagesContainer.appendChild(msgDiv);
        this.scrollToBottom();
    }

    addProductCarousel(products, intro = '') {
        if (products.length === 0) {
            this.addMessage("I couldn't find any matching products. Try a different search term! 🔍");
            return;
        }

        if (intro) this.addMessage(intro);

        const maxShow = Math.min(products.length, 10);
        const shown = products.slice(0, maxShow);

        let cardsHTML = shown.map(p => {
            const img = getAbsoluteImageUrl(p.image);
            const price = p.offerPrice || p.price;
            const url = this.getProductUrl(p);
            const stockLabel = p.stock === 0 ? '<span class="chat-card-oos">Out of Stock</span>' : '';
            return `
                <a href="${url}" target="_blank" rel="noopener" class="chat-product-card">
                    <img src="${img}" alt="${p.name}" loading="lazy">
                    <div class="chat-card-info">
                        <div class="chat-card-name">${p.name}</div>
                        <div class="chat-card-price">৳${price.toFixed(2)}</div>
                        ${stockLabel}
                    </div>
                </a>
            `;
        }).join('');

        const extra = products.length > maxShow
            ? `<div class="chat-carousel-more">+${products.length - maxShow} more</div>` : '';

        this.addRichMessage(`<div class="chat-carousel">${cardsHTML}${extra}</div>`);

        if (products.length > maxShow) {
            this.addMessage(`I found ${products.length} products total! I'm showing the top ${maxShow}. Try refining your search for more specific results. 😊`);
        }
    }

    addLinkButton(text, url, icon = '🔗') {
        this.addRichMessage(`
            <a href="${url}" target="_blank" rel="noopener" class="chat-link-btn">
                <span>${icon}</span> ${text}
            </a>
        `);
    }

    addActionButtons(buttons) {
        const html = buttons.map(b =>
            `<button class="chat-inline-action" data-chataction="${b.action}">${b.label}</button>`
        ).join('');
        const msgDiv = document.createElement('div');
        msgDiv.className = 'chat-msg bot chat-rich';
        msgDiv.innerHTML = `<div class="chat-inline-actions">${html}</div>`;
        msgDiv.querySelectorAll('.chat-inline-action').forEach(btn => {
            btn.addEventListener('click', () => {
                this.addMessage(btn.textContent, 'user');
                this.processIntent(btn.dataset.chataction, btn.textContent);
            });
        });
        this.messagesContainer.appendChild(msgDiv);
        this.scrollToBottom();
    }

    addLoginPrompt(message) {
        this.addMessage(message);
        this.addRichMessage(`
            <button class="chat-login-btn" onclick="if(window.openAuthModal) window.openAuthModal('login');">
                <span class="material-icons-round" style="font-size: 16px; vertical-align: middle; margin-right: 4px;">login</span>
                Log In to Continue
            </button>
        `);
    }

    addTypingIndicator() {
        const typing = document.createElement('div');
        typing.className = 'chat-msg bot chat-typing';
        typing.id = 'chat-typing-indicator';
        typing.innerHTML = '<span></span><span></span><span></span>';
        this.messagesContainer.appendChild(typing);
        this.scrollToBottom();
    }

    removeTypingIndicator() {
        const el = document.getElementById('chat-typing-indicator');
        if (el) el.remove();
    }

    scrollToBottom() {
        this.messagesContainer.scrollTop = this.messagesContainer.scrollHeight;
    }

    hideActions() {
        if (this.actionsContainer) {
            this.actionsContainer.style.transition = 'opacity 0.3s, transform 0.3s';
            this.actionsContainer.style.opacity = '0';
            this.actionsContainer.style.transform = 'translateY(10px)';
            setTimeout(() => {
                this.actionsContainer.style.display = 'none';
            }, 300);
        }
    }

    // ─── Quick Actions (Suggestions) ──────────────────────────────

    handleAction(action, label) {
        this.addMessage(label, 'user');
        this.processIntent(action, label);
    }

    // ─── Send Message ─────────────────────────────────────────────

    handleSendMessage() {
        const text = this.inputField.value.trim();
        if (!text) return;

        this.addMessage(text, 'user');
        this.inputField.value = '';

        this.addTypingIndicator();
        setTimeout(() => {
            this.removeTypingIndicator();
            this.processMessage(text);
        }, 500 + Math.random() * 400);
    }

    // ─── Intent Detection ─────────────────────────────────────────

    detectIntent(text) {
        const lower = text.toLowerCase().trim();

        // Greeting
        if (/^(hi|hello|hey|howdy|good\s*(morning|evening|afternoon)|assalamu|salam|yo)\b/.test(lower)) {
            return { intent: 'greeting' };
        }

        // Admin-only intents
        if (state.isAdmin) {
            if (/(?:check\s*)?stock|inventory|how\s*many\s*left/i.test(lower)) {
                return { intent: 'admin_stock_check' };
            }
            if (/(?:sales|orders|revenue|stats|statistics|summary)/i.test(lower)) {
                return { intent: 'admin_sales_stats' };
            }
        }

        // Invoice / Order by ID
        const invoiceMatch = lower.match(/(?:invoice|order)\s*#?\s*(\d+)/i)
            || lower.match(/#(\d+)/)
            || lower.match(/(?:show|view|see|find|get)\s+(?:my\s+)?(?:invoice|order)\s*#?\s*(\d+)/i);
        if (invoiceMatch) {
            const orderId = invoiceMatch[1] || invoiceMatch[2];
            return { intent: 'view_invoice', orderId };
        }

        // List all orders
        if (/(?:my\s+orders|order\s*history|past\s*orders|all\s*orders|show\s*(?:my\s+)?orders)/i.test(lower)) {
            return { intent: 'list_orders' };
        }

        // Track order (generic)
        if (/(?:track|where|status)\s*(?:my|of)?\s*(?:order|package|delivery)/i.test(lower)) {
            return { intent: 'track_order' };
        }

        // Category browse
        if (/(?:what|show|list)\s*(?:are\s*)?(?:the\s*)?(?:categories|collections|types)/i.test(lower)) {
            return { intent: 'list_categories' };
        }

        // Specific category
        for (const cat of state.categories) {
            if (lower.includes(cat.slug) || lower.includes(cat.id.toLowerCase())) {
                return { intent: 'browse_category', category: cat };
            }
        }

        // Product search by color
        const colors = ['red', 'blue', 'green', 'yellow', 'pink', 'purple', 'orange', 'black', 'white', 'brown', 'gold', 'silver', 'grey', 'gray'];
        for (const color of colors) {
            if (lower.includes(color)) {
                return { intent: 'product_search_color', color };
            }
        }

        // Product search by name
        if (/(?:show|find|search|look|want|need|any|got)\s+(?:me\s+)?(.+)/i.test(lower)) {
            const keyword = lower.match(/(?:show|find|search|look|want|need|any|got)\s+(?:me\s+)?(.+)/i)[1]
                .replace(/products?|items?|stuff|things?/gi, '').trim();
            if (keyword.length > 1) {
                return { intent: 'product_search', keyword };
            }
        }

        // Price inquiry
        if (/(?:price|cost|how\s*much|cheapest|expensive|affordable)/i.test(lower)) {
            if (/cheapest|lowest|affordable|budget/i.test(lower)) {
                return { intent: 'cheapest_products' };
            }
            if (/expensive|costly|premium|highest/i.test(lower)) {
                return { intent: 'expensive_products' };
            }
            return { intent: 'price_info' };
        }

        // Stock
        if (/(?:in\s*stock|available|out\s*of\s*stock|stock)/i.test(lower)) {
            return { intent: 'stock_check' };
        }

        // New/Sale
        if (/(?:new\s*(?:arrivals?|products?)|what'?s?\s*new|latest)/i.test(lower)) {
            return { intent: 'new_products' };
        }
        if (/(?:sale|discount|offer|deal)/i.test(lower)) {
            return { intent: 'sale_products' };
        }

        // Shipping
        if (/(?:shipping|deliver|delivery|ship|how long|when.*arrive)/i.test(lower)) {
            return { intent: 'shipping_info' };
        }

        // Return
        if (/(?:return|refund|exchange|replace)/i.test(lower)) {
            return { intent: 'return_policy' };
        }

        // Payment
        if (/(?:payment|pay|cash|bkash|nagad|card)/i.test(lower)) {
            return { intent: 'payment_info' };
        }

        // Cart
        if (/(?:cart|basket|bag|checkout)/i.test(lower)) {
            return { intent: 'cart_help' };
        }

        // Profile / Account
        if (/(?:profile|account|settings|my\s*info|login|register|sign\s*up|sign\s*in)/i.test(lower)) {
            return { intent: 'account_help' };
        }

        // Contact / Human
        if (/(?:contact|human|person|talk|real|support|agent|whatsapp|messenger|instagram)/i.test(lower)) {
            return { intent: 'contact_human' };
        }

        // Thank you
        if (/(?:thanks?|thank\s*you|thx|ty|appreciated)/i.test(lower)) {
            return { intent: 'thanks' };
        }

        // Bye
        if (/(?:bye|goodbye|see\s*you|later|good\s*night)/i.test(lower)) {
            return { intent: 'goodbye' };
        }

        // Fallback — try product name match
        const nameMatches = this.searchProductsByName(lower);
        if (nameMatches.length > 0) {
            return { intent: 'product_search', keyword: lower, directResults: nameMatches };
        }

        return { intent: 'unknown' };
    }

    // ─── Product Search Functions ─────────────────────────────────

    searchProductsByName(keyword) {
        const lower = keyword.toLowerCase();
        return state.inventory.filter(p => {
            const name = (p.name || '').toLowerCase();
            const desc = (p.description || '').toLowerCase();
            return name.includes(lower) || desc.includes(lower);
        });
    }

    searchProductsByColor(color) {
        const lower = color.toLowerCase();
        return state.inventory.filter(p => {
            const name = (p.name || '').toLowerCase();
            const desc = (p.description || '').toLowerCase();
            return name.includes(lower) || desc.includes(lower);
        });
    }

    getNewProducts() {
        return state.inventory.filter(p => p.isNew);
    }

    getSaleProducts() {
        return state.inventory.filter(p => p.isSale || (p.offerPrice && p.offerPrice < p.price));
    }

    getInStockProducts() {
        return state.inventory.filter(p => p.stock === undefined || p.stock > 0);
    }

    getCheapestProducts(limit = 10) {
        return [...state.inventory]
            .filter(p => p.stock === undefined || p.stock > 0)
            .sort((a, b) => (a.offerPrice || a.price) - (b.offerPrice || b.price))
            .slice(0, limit);
    }

    getMostExpensiveProducts(limit = 10) {
        return [...state.inventory]
            .filter(p => p.stock === undefined || p.stock > 0)
            .sort((a, b) => (b.offerPrice || b.price) - (a.offerPrice || a.price))
            .slice(0, limit);
    }

    // ─── Intent Processing ────────────────────────────────────────

    processMessage(text) {
        const result = this.detectIntent(text);
        this.processIntent(result.intent, text, result);
    }

    async processIntent(intent, text = '', data = {}) {
        switch (intent) {
            case 'greeting':
                this.handleGreeting();
                break;

            case 'product_search':
                this.handleProductSearch(data.keyword || text, data.directResults);
                break;

            case 'product_search_color':
                this.handleColorSearch(data.color);
                break;

            case 'browse_category':
                this.handleCategoryBrowse(data.category);
                break;

            case 'list_categories':
                this.handleListCategories();
                break;

            case 'view_invoice':
                await this.handleViewInvoice(data.orderId);
                break;

            case 'list_orders':
                await this.handleListOrders();
                break;

            case 'admin_stock_check':
                this.handleAdminStockCheck();
                break;

            case 'admin_sales_stats':
                await this.handleAdminSalesStats();
                break;

            case 'track_order':
                this.handleTrackOrder();
                break;

            case 'cheapest_products':
                this.handleCheapest();
                break;

            case 'expensive_products':
                this.handleExpensive();
                break;

            case 'price_info':
                this.handlePriceInfo();
                break;

            case 'new_products':
                this.handleNewProducts();
                break;

            case 'sale_products':
                this.handleSaleProducts();
                break;

            case 'stock_check':
                this.handleStockCheck();
                break;

            case 'shipping_info':
            case 'shipping':
                this.handleShipping();
                break;

            case 'return_policy':
            case 'return':
                this.handleReturn();
                break;

            case 'payment_info':
                this.handlePayment();
                break;

            case 'cart_help':
                this.handleCartHelp();
                break;

            case 'account_help':
                this.handleAccountHelp();
                break;

            case 'contact_human':
            case 'human':
                this.handleContactHuman();
                break;

            case 'track':
                this.handleTrackOrder();
                break;

            case 'thanks':
                this.addMessage("You're welcome! 😊 If you need anything else, I'm always here. Happy shopping! 🛒");
                break;

            case 'goodbye':
                this.addMessage(`Goodbye${this.isLoggedIn() ? ', ' + this.getUserName() : ''}! 👋 Have a wonderful day! Come back anytime.`);
                break;

            default:
                this.handleUnknown(text);
                break;
        }
    }

    // ─── Intent Handlers ──────────────────────────────────────────

    handleGreeting() {
        if (state.isAdmin) {
            this.addMessage(`System accessing... Hello Admin ${this.getUserName()}! 🛡️ I'm ready to assist with store management. What would you like to check?`);
            this.addActionButtons([
                { label: '📊 Sales Stats', action: 'admin_sales_stats' },
                { label: '📦 Global Tracking', action: 'track_order' },
                { label: '📉 Low Stock', action: 'admin_stock_check' },
                { label: '👥 User List', action: 'contact_human' } // Repurposed for now
            ]);
        } else if (this.isLoggedIn()) {
            this.addMessage(`Hello, ${this.getUserName()}! 👋 Welcome back to Toy & Craft! How can I help you today?`);
            this.addDefaultSuggestions();
        } else {
            this.addMessage("Hello! 👋 Welcome to Toy & Craft. I'm your AI shopping assistant. How can I help you today?");
            this.addDefaultSuggestions();
        }
    }

    addDefaultSuggestions() {
        this.addActionButtons([
            { label: '🔍 Search Products', action: 'list_categories' },
            { label: '📦 Track Order', action: 'track_order' },
            { label: '🚚 Shipping Info', action: 'shipping_info' },
            { label: '💬 Talk to Human', action: 'contact_human' }
        ]);
    }

    handleProductSearch(keyword, directResults = null) {
        const results = directResults || this.searchProductsByName(keyword);
        if (results.length === 0) {
            this.addMessage(`I couldn't find any products matching "${keyword}". 😔`);
            this.addMessage("Try searching by category name, color, or a more specific product name!");
            this.addActionButtons([
                { label: '📂 See Categories', action: 'list_categories' },
                { label: '🆕 New Arrivals', action: 'new_products' },
                { label: '💰 On Sale', action: 'sale_products' }
            ]);
        } else {
            this.addProductCarousel(results, `I found ${results.length} product${results.length > 1 ? 's' : ''} for "${keyword}"! 🎉`);
        }
    }

    handleColorSearch(color) {
        const results = this.searchProductsByColor(color);
        if (results.length === 0) {
            this.addMessage(`I couldn't find any ${color} products right now. 😔 Try another color or browse our categories!`);
            this.addActionButtons([
                { label: '📂 See Categories', action: 'list_categories' }
            ]);
        } else {
            this.addProductCarousel(results, `Here are the ${color} products I found! 🎨`);
        }
    }

    handleCategoryBrowse(category) {
        const products = state.inventory.filter(p => p.categorySlug === category.slug);
        if (products.length === 0) {
            this.addMessage(`The "${category.id}" category is currently empty. Check back soon! 🔜`);
        } else {
            this.addProductCarousel(products, `Here are all the products in ${category.id}! 🧱`);
        }
    }

    handleListCategories() {
        if (state.categories.length === 0) {
            this.addMessage("No categories are available at the moment. Please check back later!");
            return;
        }

        this.addMessage("Here are our product categories! Tap any to browse: 📂");
        const buttons = state.categories.map(cat => ({
            label: `🏷️ ${cat.id}`,
            action: 'browse_category_' + cat.slug
        }));

        // Register temporary handlers for dynamic category actions
        const msgDiv = document.createElement('div');
        msgDiv.className = 'chat-msg bot chat-rich';
        const html = buttons.map(b =>
            `<button class="chat-inline-action" data-catslug="${b.action.replace('browse_category_', '')}">${b.label}</button>`
        ).join('');
        msgDiv.innerHTML = `<div class="chat-inline-actions">${html}</div>`;
        msgDiv.querySelectorAll('.chat-inline-action').forEach(btn => {
            btn.addEventListener('click', () => {
                const slug = btn.dataset.catslug;
                const cat = state.categories.find(c => c.slug === slug);
                if (cat) {
                    this.addMessage(btn.textContent, 'user');
                    this.handleCategoryBrowse(cat);
                }
            });
        });
        this.messagesContainer.appendChild(msgDiv);
        this.scrollToBottom();
    }

    async handleViewInvoice(orderId) {
        if (!this.isLoggedIn()) {
            this.addLoginPrompt("You need to be logged in to view invoices. Please log in first! 🔐");
            return;
        }

        this.addMessage(`Let me check invoice #${orderId} for you... 🔍`);
        this.addTypingIndicator();

        try {
            const orderSnap = await getDoc(doc(db, 'Orders', orderId));

            this.removeTypingIndicator();

            if (!orderSnap.exists()) {
                this.addMessage(`I couldn't find invoice #${orderId}. Please check the order number and try again. 🤷`);
                return;
            }

            const data = orderSnap.data();

            // Authorization check
            if (data.userId !== state.currentUser.id) {
                this.addMessage("⚠️ This invoice belongs to a different account. I can only show you invoices linked to your account for security.");
                return;
            }

            // Authorized — show invoice details and link
            const statusEmoji = data.status === 'Delivered' ? '✅' : data.status === 'Sent' ? '🚚' : '⏳';
            const dateStr = new Date(data.createdAt).toLocaleDateString('en-GB', {
                day: 'numeric', month: 'short', year: 'numeric'
            });

            this.addMessage(`${statusEmoji} Invoice #${orderId}\n📅 Date: ${dateStr}\n💰 Total: ৳${(data.totalPrice || 0).toFixed(2)}\n📋 Status: ${data.status || 'Pending'}\n📦 Items: ${(data.items || []).length}`);

            // Show Steadfast tracking info if available
            if (data.tracking_code) {
                const sfStatus = getStatusDisplay(data.steadfast_status);
                this.addMessage(`🚚 Tracking Code: ${data.tracking_code}\n${sfStatus.emoji} Delivery: ${sfStatus.label}`);

                // Fetch live status
                try {
                    const liveResult = await trackByInvoice(orderId);
                    if (liveResult.success) {
                        const liveDisplay = getStatusDisplay(liveResult.delivery_status);
                        this.addMessage(`📡 Live Status: ${liveDisplay.emoji} ${liveDisplay.label}`);
                    }
                } catch (e) { /* silent */ }
            }

            const url = this.getInvoiceUrl(orderId);
            if (url) {
                this.addLinkButton(`View Full Invoice #${orderId}`, url, '🧾');
            }

        } catch (err) {
            this.removeTypingIndicator();
            console.error('Chatbot invoice error:', err);
            this.addMessage("Oops! Something went wrong while fetching the invoice. Please try again later. 😓");
        }
    }

    async handleListOrders() {
        if (!this.isLoggedIn()) {
            this.addLoginPrompt("You need to log in to see your order history. 🔐");
            return;
        }

        this.addMessage("Fetching your orders... 📦");
        this.addTypingIndicator();

        try {
            const q = query(collection(db, 'Orders'), where('userId', '==', state.currentUser.id));
            const snap = await getDocs(q);

            this.removeTypingIndicator();

            if (snap.empty) {
                this.addMessage("You don't have any orders yet. Start shopping and place your first order! 🛍️");
                this.addActionButtons([
                    { label: '📂 Browse Products', action: 'list_categories' }
                ]);
                return;
            }

            const orders = snap.docs.map(d => ({ id: d.id, ...d.data() }));
            orders.sort((a, b) => (b.createdAt || 0) - (a.createdAt || 0));

            this.addMessage(`You have ${orders.length} order${orders.length > 1 ? 's' : ''}! Here they are:`);

            // Show as cards with links
            const maxShow = Math.min(orders.length, 5);
            for (let i = 0; i < maxShow; i++) {
                const o = orders[i];
                const statusEmoji = o.status === 'Delivered' ? '✅' : o.status === 'Sent' ? '🚚' : '⏳';
                const dateStr = new Date(o.createdAt).toLocaleDateString('en-GB', { day: 'numeric', month: 'short' });
                const url = this.getInvoiceUrl(o.id);
                this.addRichMessage(`
                    <div class="chat-order-card">
                        <div class="chat-order-header">
                            <span>${statusEmoji} #${o.id}</span>
                            <span class="chat-order-date">${dateStr}</span>
                        </div>
                        <div class="chat-order-detail">৳${(o.totalPrice || 0).toFixed(2)} · ${(o.items || []).length} items · ${o.status || 'Pending'}</div>
                        ${url ? `<a href="${url}" target="_blank" rel="noopener" class="chat-link-btn chat-link-btn-sm">🧾 View Invoice</a>` : ''}
                    </div>
                `);
            }

            if (orders.length > maxShow) {
                this.addMessage(`Showing your ${maxShow} most recent orders. Visit your Profile → Orders to see all ${orders.length}. 📋`);
            }

        } catch (err) {
            this.removeTypingIndicator();
            console.error('Chatbot orders error:', err);
            this.addMessage("Something went wrong fetching your orders. Please try again! 😓");
        }
    }

    handleTrackOrder() {
        if (!this.isLoggedIn()) {
            this.addLoginPrompt("Please log in first so I can check your orders. 🔐");
            return;
        }
        this.addMessage("To track a specific order, tell me the order number (e.g., \"show invoice #1001\").");
        this.addMessage("Or I can show you all your orders!");
        this.addActionButtons([
            { label: '📋 Show All Orders', action: 'list_orders' }
        ]);
    }

    handleCheapest() {
        const products = this.getCheapestProducts(10);
        this.addProductCarousel(products, "Here are our most budget-friendly products! 💰");
    }

    handleExpensive() {
        const products = this.getMostExpensiveProducts(10);
        this.addProductCarousel(products, "Here are our premium, top-tier products! 💎");
    }

    handlePriceInfo() {
        const inStock = this.getInStockProducts();
        if (inStock.length === 0) {
            this.addMessage("No products are currently in stock. Check back soon!");
            return;
        }
        const prices = inStock.map(p => p.offerPrice || p.price);
        const min = Math.min(...prices);
        const max = Math.max(...prices);
        this.addMessage(`Our products range from ৳${min.toFixed(2)} to ৳${max.toFixed(2)}! 🏷️`);
        this.addActionButtons([
            { label: '💰 Show Cheapest', action: 'cheapest_products' },
            { label: '💎 Show Premium', action: 'expensive_products' },
            { label: '🏷️ On Sale', action: 'sale_products' }
        ]);
    }

    handleNewProducts() {
        const products = this.getNewProducts();
        if (products.length === 0) {
            this.addMessage("No products are marked as new right now. Check out our full collection instead! 🧱");
            this.addActionButtons([{ label: '📂 See Categories', action: 'list_categories' }]);
        } else {
            this.addProductCarousel(products, "Here are our latest arrivals! 🆕");
        }
    }

    handleSaleProducts() {
        const products = this.getSaleProducts();
        if (products.length === 0) {
            this.addMessage("No sale items at the moment. Keep an eye out — deals come and go fast! ⚡");
            this.addActionButtons([{ label: '📂 See Categories', action: 'list_categories' }]);
        } else {
            this.addProductCarousel(products, "🔥 These products are on sale right now!");
        }
    }

    handleStockCheck() {
        const outOfStock = state.inventory.filter(p => p.stock === 0);
        const inStock = state.inventory.filter(p => p.stock === undefined || p.stock > 0);
        this.addMessage(`📊 Stock Status:\n✅ ${inStock.length} products in stock\n❌ ${outOfStock.length} products out of stock`);
        if (outOfStock.length > 0 && outOfStock.length <= 10) {
            this.addMessage("Out of stock items: " + outOfStock.map(p => p.name).join(', '));
        }
    }

    handleShipping() {
        this.addMessage("🚚 Shipping Information:\n\n📍 Inside Dhaka: ৳60 (2-3 days)\n📍 Dhaka Sub-Urban: ৳100 (3-4 days)\n📍 Outside Dhaka: ৳120 (3-5 days)\n\n💫 Free shipping on orders over ৳5000!\n\n💵 Payment: Cash on Delivery (COD)");
    }

    handleReturn() {
        this.addMessage("📋 Return Policy:\n\n✅ 7-day return window\n✅ Item must be unused & in original packaging\n✅ Contact us via Messenger or WhatsApp to initiate a return\n\n⚠️ Custom or personalized items cannot be returned.");
        this.addActionButtons([
            { label: '💬 Contact Us', action: 'contact_human' }
        ]);
    }

    handlePayment() {
        this.addMessage("💳 Payment Methods:\n\n💵 Cash on Delivery (COD) — Pay when your order arrives!\n\nWe currently accept COD only across Bangladesh. 🇧🇩");
    }

    handleCartHelp() {
        const cartCount = state.cart.reduce((sum, item) => sum + item.qty, 0);
        if (cartCount === 0) {
            this.addMessage("Your cart is empty! 🛒 Browse our products and add items to get started.");
            this.addActionButtons([{ label: '📂 Browse Categories', action: 'list_categories' }]);
        } else {
            this.addMessage(`You have ${cartCount} item${cartCount > 1 ? 's' : ''} in your cart! 🛒\n\nClick the 🛒 icon in the top-right corner to view your cart and proceed to checkout.`);
        }
    }

    handleAccountHelp() {
        if (this.isLoggedIn()) {
            const user = state.currentUser;
            this.addMessage(`You're logged in as:\n👤 ${user.name || user.id}\n📧 ${user.email || 'N/A'}\n📱 ${user.mobile || 'N/A'}`);
            const base = this.getBaseUrl();
            this.addLinkButton('View My Profile', `${base}${user.id}/Details`, '👤');
            this.addLinkButton('View My Orders', `${base}${user.id}/Orders`, '📦');
        } else {
            this.addMessage("You're not logged in yet. Log in to access your profile, order history, and more! 🔐");
            this.addRichMessage(`
                <div class="chat-inline-actions">
                    <button class="chat-login-btn" onclick="if(window.openAuthModal) window.openAuthModal('login');">
                        <span class="material-icons-round" style="font-size: 16px; vertical-align: middle; margin-right: 4px;">login</span> Log In
                    </button>
                    <button class="chat-login-btn" onclick="if(window.openAuthModal) window.openAuthModal('register');" style="background: #27ae60;">
                        <span class="material-icons-round" style="font-size: 16px; vertical-align: middle; margin-right: 4px;">person_add</span> Register
                    </button>
                </div>
            `);
        }
    }

    handleContactHuman() {
        this.addMessage("I'll connect you to a real person! 💬 Click any option below to chat with our team directly:");
        this.addRichMessage(`
            <div class="chat-social-links">
                <a href="https://m.me/toyandcraft" target="_blank" rel="noopener" class="chat-social-btn messenger">
                    <svg viewBox="0 0 24 24" width="18" height="18" fill="currentColor"><path d="M12 2C6.477 2 2 6.145 2 11.243c0 2.907 1.45 5.497 3.722 7.19V22l3.377-1.857c.9.25 1.855.387 2.843.387 5.523 0 10-4.144 10-9.244S17.523 2 12 2z"/></svg>
                    Messenger
                </a>
                <a href="https://wa.me/8801234567890" target="_blank" rel="noopener" class="chat-social-btn whatsapp">
                    <svg viewBox="0 0 24 24" width="18" height="18" fill="currentColor"><path d="M17.472 14.382c-.297-.149-1.758-.867-2.03-.967-.273-.099-.471-.148-.67.15-.197.297-.767.966-.94 1.164-.173.199-.347.223-.644.075-.297-.15-1.255-.463-2.39-1.475-.883-.788-1.48-1.761-1.653-2.059-.173-.297-.018-.458.13-.606.134-.133.298-.347.446-.52.149-.174.198-.298.298-.497.099-.198.05-.371-.025-.52-.075-.149-.669-1.612-.916-2.207-.242-.579-.487-.5-.669-.51-.173-.008-.371-.01-.57-.01-.198 0-.52.074-.792.372-.272.297-1.04 1.016-1.04 2.479 0 1.462 1.065 2.875 1.213 3.074.149.198 2.096 3.2 5.077 4.487.709.306 1.262.489 1.694.625.712.227 1.36.195 1.871.118.571-.085 1.758-.719 2.006-1.413.248-.694.248-1.289.173-1.413-.074-.124-.272-.198-.57-.347z"/><path d="M12 2C6.477 2 2 6.477 2 12c0 1.89.525 3.66 1.438 5.168L2 22l4.832-1.438A9.955 9.955 0 0012 22c5.523 0 10-4.477 10-10S17.523 2 12 2z"/></svg>
                    WhatsApp
                </a>
                <a href="https://instagram.com/toyandcraft" target="_blank" rel="noopener" class="chat-social-btn instagram">
                    <svg viewBox="0 0 24 24" width="18" height="18" fill="currentColor"><path d="M12 2.163c3.204 0 3.584.012 4.85.07 3.252.148 4.771 1.691 4.919 4.919.058 1.265.069 1.645.069 4.849 0 3.205-.012 3.584-.069 4.849-.149 3.225-1.664 4.771-4.919 4.919-1.266.058-1.644.07-4.85.07-3.204 0-3.584-.012-4.849-.07-3.26-.149-4.771-1.699-4.919-4.92-.058-1.265-.07-1.644-.07-4.849 0-3.204.013-3.583.07-4.849.149-3.227 1.664-4.771 4.919-4.919 1.266-.057 1.645-.069 4.849-.069zM12 0C8.741 0 8.333.014 7.053.072 2.695.272.273 2.69.073 7.052.014 8.333 0 8.741 0 12c0 3.259.014 3.668.072 4.948.2 4.358 2.618 6.78 6.98 6.98C8.333 23.986 8.741 24 12 24c3.259 0 3.668-.014 4.948-.072 4.354-.2 6.782-2.618 6.979-6.98.059-1.28.073-1.689.073-4.948 0-3.259-.014-3.667-.072-4.947-.196-4.354-2.617-6.78-6.979-6.98C15.668.014 15.259 0 12 0zm0 5.838a6.162 6.162 0 100 12.324 6.162 6.162 0 000-12.324zM12 16a4 4 0 110-8 4 4 0 010 8zm6.406-11.845a1.44 1.44 0 100 2.881 1.44 1.44 0 000-2.881z"/></svg>
                    Instagram
                </a>
            </div>
        `);
    }

    handleUnknown(text) {
        // Last resort — try fuzzy product search with the full message
        const results = this.searchProductsByName(text);
        if (results.length > 0) {
            this.addProductCarousel(results, `I found some products that might match what you're looking for! 🔍`);
            return;
        }

        this.addMessage("I'm not sure I understand that. 🤔 Here's what I can help you with:");
        if (state.isAdmin) {
            this.addActionButtons([
                { label: '📊 Sales Stats', action: 'admin_sales_stats' },
                { label: '📉 Low Stock', action: 'admin_stock_check' },
                { label: '📦 Global Tracking', action: 'track_order' }
            ]);
        } else {
            this.addActionButtons([
                { label: '🔍 Search Products', action: 'list_categories' },
                { label: '📦 Track Order', action: 'track_order' },
                { label: '🚚 Shipping Info', action: 'shipping_info' },
                { label: '↩️ Return Policy', action: 'return_policy' },
                { label: '💬 Talk to Human', action: 'contact_human' }
            ]);
        }
    }

    // ─── Admin Mode Handlers ─────────────────────────────────────

    handleAdminStockCheck() {
        const outOfStock = state.inventory.filter(p => (p.stock === 0 || p.stock === '0'));
        const lowStock = state.inventory.filter(p => {
            const s = parseInt(p.stock);
            return !isNaN(s) && s > 0 && s <= 5;
        });

        if (outOfStock.length === 0 && lowStock.length === 0) {
            this.addMessage("Excellent news! All products have healthy stock levels right now. ✅");
        } else {
            if (outOfStock.length > 0) {
                this.addMessage(`There are ${outOfStock.length} items currently out of stock. ❌`);
                this.addProductCarousel(outOfStock.slice(0, 5), "Here are the top out-of-stock items:");
            }
            if (lowStock.length > 0) {
                this.addMessage(`Heads up! ${lowStock.length} items are running low on stock (5 or less). ⚠️`);
                this.addProductCarousel(lowStock.slice(0, 5), "Items needing restock soon:");
            }
        }
    }

    async handleAdminSalesStats() {
        this.addTypingIndicator();
        try {
            const ordersSnap = await getDocs(collection(db, 'Orders'));
            const orders = ordersSnap.docs.map(doc => doc.data());
            
            const totalOrders = orders.length;
            const completedOrders = orders.filter(o => o.status === 'Delivered').length;
            const pendingOrders = orders.filter(o => o.status === 'Pending').length;
            const totalRevenue = orders.filter(o => o.status !== 'Cancelled').reduce((sum, o) => sum + (parseFloat(o.total) || 0), 0);

            this.removeTypingIndicator();
            this.addRichMessage(`
                <div style="background: var(--bg-hover); padding: 1.25rem; border-radius: 12px; border: 1px solid var(--border-color); box-shadow: 0 4px 12px rgba(0,0,0,0.05);">
                    <h4 style="margin-top:0; color:var(--primary); font-family:var(--font-heading); font-size:1.1rem; display:flex; align-items:center; gap:8px;">
                        <span class="material-icons-round" style="font-size:20px;">analytics</span> Store Performance
                    </h4>
                    <div style="display: grid; grid-template-columns: 1fr 1fr; gap: 12px; font-size: 0.9rem;">
                        <div style="background:var(--bg-card); padding:8px; border-radius:6px;">
                            <div style="color:var(--text-muted); font-size:0.75rem;">Total Orders</div>
                            <div style="font-weight:700; font-size:1.1rem;">${totalOrders}</div>
                        </div>
                        <div style="background:var(--bg-card); padding:8px; border-radius:6px;">
                            <div style="color:var(--text-muted); font-size:0.75rem;">Revenue</div>
                            <div style="font-weight:700; font-size:1.1rem; color:var(--primary);">৳${totalRevenue.toLocaleString()}</div>
                        </div>
                        <div style="background:var(--bg-card); padding:8px; border-radius:6px;">
                            <div style="color:var(--text-muted); font-size:0.75rem;">Pending</div>
                            <div style="font-weight:700; font-size:1.1rem; color:#f39c12;">${pendingOrders}</div>
                        </div>
                        <div style="background:var(--bg-card); padding:8px; border-radius:6px;">
                            <div style="color:var(--text-muted); font-size:0.75rem;">Delivered</div>
                            <div style="font-weight:700; font-size:1.1rem; color:#27ae60;">${completedOrders}</div>
                        </div>
                    </div>
                </div>
            `);
        } catch (err) {
            console.error(err);
            this.removeTypingIndicator();
            this.addMessage("Sorry, I encountered an error while fetching sales statistics. 🛑");
        }
    }
}

/**
 * AI 3D Cat Companion Logic (Three.js)
 * Building a "Toy-style" 3D cat procedurally
 */
class ThreeCat {
    constructor() {
        this.canvas = document.getElementById('cat-canvas');
        if (!this.canvas) return;

        this.renderer = new THREE.WebGLRenderer({ canvas: this.canvas, alpha: true, antialias: true });
        this.renderer.setPixelRatio(window.devicePixelRatio);
        this.renderer.setSize(120, 120); // Canvas internal size

        this.scene = new THREE.Scene();
        this.camera = new THREE.PerspectiveCamera(45, 1, 0.1, 1000);
        this.camera.position.set(0, 1.5, 5);

        this.setupLights();
        this.buildCat();
        this.animate();
    }

    setupLights() {
        const ambient = new THREE.AmbientLight(0xffffff, 0.8);
        this.scene.add(ambient);

        const directional = new THREE.DirectionalLight(0xffffff, 0.6);
        directional.position.set(2, 5, 5);
        this.scene.add(directional);
    }

    buildCat() {
        this.catGroup = new THREE.Group();
        this.catGroup.scale.set(0.85, 0.85, 0.85); // Shrink the model
        this.scene.add(this.catGroup);

        const orangeMaterial = new THREE.MeshStandardMaterial({ color: 0xffa500 });
        const whiteMaterial = new THREE.MeshStandardMaterial({ color: 0xffffff });
        const blackMaterial = new THREE.MeshStandardMaterial({ color: 0x333333 });

        // Body
        this.body = new THREE.Mesh(new THREE.BoxGeometry(1.2, 1, 1.5), orangeMaterial);
        this.body.position.y = 0.5;
        this.catGroup.add(this.body);

        // Head
        this.head = new THREE.Mesh(new THREE.BoxGeometry(1.4, 1.2, 1.2), orangeMaterial);
        this.head.position.set(0, 1.5, 0.6);
        this.catGroup.add(this.head);

        // Muzzle
        const muzzle = new THREE.Mesh(new THREE.BoxGeometry(0.8, 0.5, 0.3), whiteMaterial);
        muzzle.position.set(0, 1.3, 1.3); // Head origin modified
        this.catGroup.add(muzzle);

        // Ears
        const earGeo = new THREE.ConeGeometry(0.3, 0.5, 4);
        this.earL = new THREE.Mesh(earGeo, orangeMaterial);
        this.earL.position.set(0.4, 2.2, 0.6);
        this.catGroup.add(this.earL);

        this.earR = new THREE.Mesh(earGeo, orangeMaterial);
        this.earR.position.set(-0.4, 2.2, 0.6);
        this.catGroup.add(this.earR);

        // Eyes
        const eyeGeo = new THREE.SphereGeometry(0.12, 16, 16);
        this.eyeL = new THREE.Mesh(eyeGeo, blackMaterial);
        this.eyeL.position.set(0.35, 1.6, 1.15);
        this.catGroup.add(this.eyeL);

        this.eyeR = new THREE.Mesh(eyeGeo, blackMaterial);
        this.eyeR.position.set(-0.35, 1.6, 1.15);
        this.catGroup.add(this.eyeR);

        // Tail
        this.tailGroup = new THREE.Group();
        this.tailGroup.position.set(0, 0.5, -0.75);
        this.catGroup.add(this.tailGroup);

        this.tail = new THREE.Mesh(new THREE.CylinderGeometry(0.15, 0.15, 1.2), orangeMaterial);
        this.tail.rotation.x = Math.PI / 2.5;
        this.tail.position.z = -0.5;
        this.tailGroup.add(this.tail);

        this.catGroup.rotation.y = -Math.PI / 4;
    }

    animate() {
        requestAnimationFrame(() => this.animate());
        const time = Date.now() * 0.002;
        
        if (this.tailGroup) {
            this.tailGroup.rotation.y = Math.sin(time * 2) * 0.4;
        }
        if (this.head) {
            this.head.rotation.z = Math.sin(time * 1.5) * 0.05;
        }
        if (Math.sin(time * 0.5) > 0.98) {
            this.eyeL.scale.y = 0.1;
            this.eyeR.scale.y = 0.1;
        } else {
            this.eyeL.scale.y = 1;
            this.eyeR.scale.y = 1;
        }
        this.renderer.render(this.scene, this.camera);
    }

    setPose(type) {
        if (type === 'peek') {
            this.catGroup.rotation.y = 0; // Look straight ahead when peeking
            this.catGroup.position.y = -0.8; // Only show head
        } else if (type === 'rest') {
            this.catGroup.rotation.y = -Math.PI / 6;
            this.catGroup.position.y = 0;
        }
    }
}

/**
 * AI Cat Companion Logic (Controller)
 */
class CatCompanion {
    constructor() {
        this.el = document.getElementById('cat-companion');
        this.trigger = document.getElementById('chatbot-trigger');
        this.bubble = document.getElementById('cat-bubble');
        this.threeCat = null;
        this.timer = null;
        this.isHovering = false;
        this.messages = [
            "Hi there! 👋",
            "Meow! 🐾",
            "Toys! 🧸",
            "Search? 🔍",
            "Found logic! ✨",
            "Helping! 🐈",
            "Check sales? 🏷️",
            "Resting... 💤"
        ];

        this.init();
    }

    init() {
        if (!this.el) return;
        
        try {
            this.threeCat = new ThreeCat();
        } catch (e) { console.error(e); }

        // Hover events
        if (this.trigger) {
            this.trigger.addEventListener('mouseenter', () => {
                this.isHovering = true;
                this.peek(true); // Immediate pop
            });
            this.trigger.addEventListener('mouseleave', () => {
                this.isHovering = false;
                this.hide();
            });
        }

        this.scheduleNextAction();
    }

    scheduleNextAction() {
        if (this.timer) clearTimeout(this.timer);
        const delay = 15000 + Math.random() * 25000;
        this.timer = setTimeout(() => {
            if (!this.isHovering) this.performRandomAction();
            else this.scheduleNextAction();
        }, delay);
    }

    performRandomAction() {
        const isChatOpen = window.chatbot && window.chatbot.window.classList.contains('active');
        if (isChatOpen || this.isHovering) {
            this.scheduleNextAction();
            return;
        }

        const rand = Math.random();
        if (rand < 0.6) this.peek();
        else this.climbAndRest();
    }

    hide() {
        if (this.isHovering) return; // Don't hide if user is still hovering
        this.el.classList.remove('active', 'peek', 'rest');
        this.bubble.classList.remove('show');
    }

    peek(immediate = false) {
        if (this.timer && !immediate) clearTimeout(this.timer);
        
        const isChatOpen = window.chatbot && window.chatbot.window.classList.contains('active');
        if (isChatOpen) return;

        this.el.classList.remove('rest');
        if (this.threeCat) this.threeCat.setPose('peek');
        this.el.classList.add('active', 'peek');
        
        if (Math.random() > 0.5) {
            setTimeout(() => this.saySomething(), 400);
        }

        if (!immediate) {
            setTimeout(() => {
                if (!this.isHovering) {
                    this.hide();
                    this.scheduleNextAction();
                }
            }, 4000);
        }
    }

    climbAndRest() {
        const isChatOpen = window.chatbot && window.chatbot.window.classList.contains('active');
        if (isChatOpen) return;

        this.el.classList.remove('peek');
        if (this.threeCat) this.threeCat.setPose('rest');
        this.el.classList.add('active', 'rest');

        setTimeout(() => this.saySomething(), 800);

        setTimeout(() => {
            if (!this.isHovering) {
                this.hide();
                this.scheduleNextAction();
            }
        }, 6000);
    }

    saySomething() {
        const msg = this.messages[Math.floor(Math.random() * this.messages.length)];
        this.bubble.innerText = msg;
        this.bubble.classList.add('show');
        
        setTimeout(() => {
            this.bubble.classList.remove('show');
        }, 3000);
    }
}

// Initialize when the DOM is ready
document.addEventListener('DOMContentLoaded', () => {
    window.chatbot = new Chatbot();
    window.catBuddy = new CatCompanion();
});
