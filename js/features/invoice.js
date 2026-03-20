import { db, doc, getDoc } from '../config/firebase.js';
import { state } from '../core/state.js';
import { trackByInvoice, getStatusDisplay } from '../config/steadfast.js';

export async function renderInvoicePage(userId, orderId) {
    const invoiceView = document.getElementById('invoice-view');
    const invoiceContainer = document.getElementById('invoice-container');
    const mainContent = document.getElementById('main-content');
    const navbar = document.getElementById('navbar');
    const footer = document.querySelector('.footer');
    const adminBanner = document.getElementById('admin-tools-banner');
    const categoryTabs = document.querySelector('.category-tabs');
    const categoryTabsClone = document.querySelector('.category-tabs-clone');
    const heroSection = document.querySelector('.hero');
    const adminOrdersView = document.getElementById('admin-orders-view');
    const checkoutView = document.getElementById('checkout-view');
    const productView = document.getElementById('product-view');
    const shopSection = document.getElementById('shop');
    const chatWidget = document.getElementById('floating-chat-widget');

    if (!invoiceView || !invoiceContainer) return;

    // Show invoice view, hide ALL other views
    invoiceView.style.display = 'block';
    if (mainContent) mainContent.style.display = 'none';
    if (adminOrdersView) adminOrdersView.style.display = 'none';
    if (checkoutView) checkoutView.style.display = 'none';
    if (productView) productView.style.display = 'none';
    if (shopSection) shopSection.style.display = 'none';
    if (navbar) navbar.style.display = 'block';
    if (footer) footer.style.display = 'none';
    // Keep admin banner visible if in admin mode
    if (adminBanner) adminBanner.style.display = state.isAdmin ? 'flex' : 'none';
    if (categoryTabs) categoryTabs.style.display = 'none';
    if (categoryTabsClone) categoryTabsClone.style.display = 'none';
    if (heroSection) heroSection.style.display = 'none';
    if (chatWidget) chatWidget.style.display = 'none';

    invoiceContainer.innerHTML = `
        <div style="text-align: center; padding: 4rem; color: #888;">
            <span class="material-icons-round" style="font-size: 48px; display: block; margin-bottom: 1rem; animation: spin 2s linear infinite;">sync</span>
            Fetching Order Details...
        </div>
    `;

    try {
        // Try fetching from global Orders first
        let orderSnap = await getDoc(doc(db, 'Orders', orderId));
        
        // If not found (unlikely but possible if it's an old structure), try user-specific path
        if (!orderSnap.exists()) {
            orderSnap = await getDoc(doc(db, 'Users', userId, 'Orders', orderId));
        }

        if (!orderSnap.exists()) {
            invoiceContainer.innerHTML = `
                <div style="text-align: center; padding: 4rem;">
                    <span class="material-icons-round" style="font-size: 64px; color: #e53e3e; margin-bottom: 1rem;">error_outline</span>
                    <h2 style="color: #2d3436; margin-bottom: 0.5rem;">Invoice Not Found</h2>
                    <p style="color: #636e72;">The requested invoice #${orderId} could not be located.</p>
                </div>
            `;
            return;
        }

        const data = orderSnap.data();
        const dateStr = new Date(data.createdAt).toLocaleDateString('en-GB', {
            day: 'numeric', month: 'long', year: 'numeric'
        });

        const statusBadgeClass = data.status === 'Delivered' ? 'status-delivered' : (data.status === 'Sent' ? 'status-sent' : 'status-pending');

        let itemsHTML = '';
        (data.items || []).forEach(item => {
            const product = (state.inventory || []).find(p => p.id === item.id);
            const imageUrl = item.image || (product ? product.image : 'assets/placeholder-product.png');

            itemsHTML += `
                <tr class="invoice-item-row" style="border-bottom: 1px solid #eee;">
                    <td class="invoice-item-desc" style="padding: 1.2rem 0; display: flex; align-items: center; gap: 1rem;">
                        <img class="invoice-item-img" src="${imageUrl}" alt="${item.name}" style="width: 50px; height: 50px; object-fit: cover; border-radius: 4px; border: 1px solid #eee;">
                        <div class="invoice-item-info">
                            <div class="invoice-item-name" style="font-weight: 600; color: #2d3436;">${item.name}</div>
                            <div class="invoice-item-sku" style="font-size: 0.8rem; color: #636e72; margin-top: 2px;">SKU: ${item.id || 'N/A'}</div>
                        </div>
                    </td>
                    <td class="invoice-item-qty" style="padding: 1.2rem 0; text-align: center; color: #2d3436;">${item.qty}</td>
                    <td class="invoice-item-price" style="padding: 1.2rem 0; text-align: right; color: #2d3436;">৳${(item.price || 0).toFixed(2)}</td>
                    <td class="invoice-item-total" style="padding: 1.2rem 0; text-align: right; font-weight: 600; color: #2d3436;">৳${((item.price || 0) * item.qty).toFixed(2)}</td>
                </tr>
            `;
        });

        invoiceContainer.innerHTML = `
            <div class="invoice-header" style="display: flex; justify-content: space-between; align-items: flex-start; margin-bottom: 4rem;">
                <div class="invoice-brand">
                    <img src="assets/tc_logo.png" alt="Toy & Craft" style="height: 60px; margin-bottom: 1rem;">
                    <h1 style="font-size: 2rem; margin: 0; color: #007BFF; letter-spacing: -1px;">Toy & Craft</h1>
                    <p style="color: #636e72; font-size: 0.9rem; margin-top: 5px;">Premium Mini Bricks & Keyrings</p>
                </div>
                <div class="invoice-title-block" style="text-align: right;">
                    <h2 style="font-size: 2.5rem; margin: 0; color: #eee; text-transform: uppercase;">Invoice</h2>
                    <p style="font-weight: 700; color: #2d3436; margin: 5px 0;">#${orderId}</p>
                    <span class="status-badge ${statusBadgeClass}" style="display: inline-block; margin-top: 10px;">${data.status || 'Pending'}</span>
                </div>
            </div>

            <div class="invoice-billing-section" style="display: grid; grid-template-columns: 1fr 1fr; gap: 4rem; margin-bottom: 4rem;">
                <div class="billing-to">
                    <h3 style="text-transform: uppercase; font-size: 0.75rem; color: #b2bec3; letter-spacing: 1px; margin-bottom: 1rem; border-bottom: 2px solid #007BFF; width: fit-content; padding-bottom: 4px;">Billing To</h3>
                    <div style="font-weight: 700; font-size: 1.1rem; color: #2d3436;">${data.username}</div>
                    <div style="color: #636e72; font-size: 0.9rem; margin-top: 5px; line-height: 1.5;">
                        ${data.address}<br>
                        ${data.thana || ''}, ${data.district || ''}<br>
                        Phone: ${data.mobile || 'N/A'}<br>
                        ID: ${data.userId}
                    </div>
                </div>
                <div class="order-info" style="text-align: right;">
                    <h3 style="text-transform: uppercase; font-size: 0.75rem; color: #b2bec3; letter-spacing: 1px; margin-bottom: 1rem; border-bottom: 2px solid #007BFF; width: fit-content; padding-bottom: 4px; margin-left: auto;">Order Info</h3>
                    <p style="margin: 5px 0; color: #636e72;">Date: <strong style="color: #2d3436;">${dateStr}</strong></p>
                    <p style="margin: 5px 0; color: #636e72;">Payment: <strong style="color: #2d3436;">Cash on Delivery</strong></p>
                </div>
            </div>

            <table class="invoice-table" style="width: 100%; border-collapse: collapse; margin-bottom: 3rem;">
                <thead>
                    <tr style="border-bottom: 2px solid #007BFF; color: #007BFF; text-transform: uppercase; font-size: 0.75rem; letter-spacing: 1px;">
                        <th style="padding-bottom: 1rem; text-align: left;">Item Description</th>
                        <th style="padding-bottom: 1rem; text-align: center;">Qty</th>
                        <th style="padding-bottom: 1rem; text-align: right;">Unit Price</th>
                        <th style="padding-bottom: 1rem; text-align: right;">Total</th>
                    </tr>
                </thead>
                <tbody>
                    ${itemsHTML}
                </tbody>
            </table>

            <div class="invoice-summary" style="display: flex; justify-content: flex-end; margin-top: 0.5rem;">
                <div style="width: 220px;">
                    <div style="display: flex; justify-content: space-between; padding: 0.3rem 0; color: #636e72; border-bottom: 1px solid #f1f2f6; font-size: 0.9rem;">
                        <span>Subtotal</span>
                        <span>৳${(data.totalPrice - (data.deliveryCharge || 0)).toFixed(2)}</span>
                    </div>
                    <div style="display: flex; justify-content: space-between; padding: 0.3rem 0; color: #636e72; border-bottom: 1px solid #f1f2f6; font-size: 0.9rem;">
                        <span>Delivery Charge</span>
                        <span>৳${(data.deliveryCharge || 0).toFixed(2)}</span>
                    </div>
                    <div style="display: flex; justify-content: space-between; padding: 0.5rem 0; font-size: 1.1rem; font-weight: 800; color: #007BFF;">
                        <span>Grand Total</span>
                        <span>৳${(data.totalPrice || 0).toFixed(2)}</span>
                    </div>
                </div>
            </div>

            <div class="invoice-footer" style="margin-top: 2rem; padding-top: 1rem; border-top: 1px solid #eee; display: flex; justify-content: space-between; align-items: center;">
                <div>
                    <h4 style="margin: 0; color: #2d3436; font-size: 0.85rem;">Thank you for your purchase!</h4>
                    <p style="color: #636e72; font-size: 0.7rem; margin-top: 2px;">For any queries, contact us via Messenger or WhatsApp.</p>
                </div>
                <div style="text-align: right;">
                    <p style="margin: 0; font-weight: 700; color: #2d3436; font-size: 0.95rem;">Toy & Craft</p>
                    <p style="color: #636e72; font-size: 0.8rem; margin-top: 2px;">toyandcraft.shop</p>
                </div>
            </div>
        `;

        // ── Steadfast Tracking Section ────────────────────────
        if (data.tracking_code) {
            const sfStatus = getStatusDisplay(data.steadfast_status);
            const trackingSection = document.createElement('div');
            trackingSection.className = 'invoice-tracking-section';
            trackingSection.id = 'invoice-tracking';
            trackingSection.style.cssText = 'margin-top: 1.5rem; padding: 1rem 1.5rem; background: #f8f9fa; border-radius: 12px; border: 1px solid #eef1f5;';
            trackingSection.innerHTML = `
                <div style="display: flex; justify-content: space-between; align-items: center; flex-wrap: wrap; gap: 0.5rem;">
                    <div>
                        <h4 style="margin: 0 0 4px; font-size: 0.85rem; color: #636e72; text-transform: uppercase; letter-spacing: 0.5px;">📦 Delivery Tracking</h4>
                        <div style="font-size: 0.95rem; font-weight: 700; color: #2d3436;">Tracking Code: <span style="color: #007BFF; font-family: monospace; letter-spacing: 1px;">${data.tracking_code}</span></div>
                    </div>
                    <div style="text-align: right;">
                        <div id="sf-live-status" style="display: inline-flex; align-items: center; gap: 6px; padding: 6px 14px; border-radius: 20px; background: ${sfStatus.color}20; color: ${sfStatus.color}; font-weight: 700; font-size: 0.85rem;">
                            ${sfStatus.emoji} ${sfStatus.label}
                        </div>
                        <div style="font-size: 0.7rem; color: #b2bec3; margin-top: 4px;">Powered by Steadfast Courier</div>
                    </div>
                </div>
            `;
            invoiceContainer.appendChild(trackingSection);

            // Fetch live status from Steadfast API
            trackByInvoice(orderId).then(result => {
                if (result.success) {
                    const liveStatus = getStatusDisplay(result.delivery_status);
                    const statusEl = document.getElementById('sf-live-status');
                    if (statusEl) {
                        statusEl.style.background = `${liveStatus.color}20`;
                        statusEl.style.color = liveStatus.color;
                        statusEl.innerHTML = `${liveStatus.emoji} ${liveStatus.label}`;
                    }
                }
            }).catch(() => {});
        }

        // Dynamic Auto-Scaling for Print
        const itemCount = (data.items || []).length;
        invoiceContainer.className = 'invoice-container'; // Reset classes
        if (itemCount > 18) {
            invoiceContainer.classList.add('compact-level-3');
        } else if (itemCount > 12) {
            invoiceContainer.classList.add('compact-level-2');
        } else if (itemCount > 6) {
            invoiceContainer.classList.add('compact-level-1');
        }

        // Update document title for printing
        document.title = `Invoice_${orderId}_Toy_And_Craft`;

    } catch (error) {
        console.error("Invoice Error:", error);
        invoiceContainer.innerHTML = `
            <div style="text-align: center; padding: 4rem;">
                <span class="material-icons-round" style="font-size: 64px; color: #e53e3e; margin-bottom: 1rem;">error</span>
                <h2 style="color: #2d3436; margin-bottom: 0.5rem;">Something went wrong</h2>
                <p style="color: #636e72;">Could not load invoice data. Please try again later.</p>
            </div>
        `;
    }
}

window.renderInvoicePage = renderInvoicePage;

// Cleanup: hide invoice and restore regular UI when navigating away
export function cleanupInvoiceView() {
    const invoiceView = document.getElementById('invoice-view');
    if (!invoiceView || invoiceView.style.display === 'none') return; // nothing to clean

    invoiceView.style.display = 'none';

    // Restore elements that were hidden
    const navbar = document.getElementById('navbar');
    const footer = document.querySelector('.footer');
    const mainContent = document.getElementById('main-content');
    const categoryTabs = document.querySelector('.category-tabs');
    const categoryTabsClone = document.querySelector('.category-tabs-clone');
    const adminBanner = document.getElementById('admin-tools-banner');

    if (navbar) navbar.style.display = '';
    if (footer) footer.style.display = '';
    if (mainContent) mainContent.style.display = 'block';
    if (categoryTabs) categoryTabs.style.display = '';
    if (categoryTabsClone) categoryTabsClone.style.display = '';

    // Restore admin banner if in admin mode
    if (adminBanner && state.isAdmin) adminBanner.style.display = 'flex';

    // Restore the page title
    document.title = 'Toy & Craft';
}
window.cleanupInvoiceView = cleanupInvoiceView;
