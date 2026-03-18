import { db, doc, getDoc } from '../config/firebase.js';
import { state } from '../core/state.js';

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

    if (!invoiceView || !invoiceContainer) return;

    // Show invoice view, hide others
    invoiceView.style.display = 'block';
    if (mainContent) mainContent.style.display = 'none';
    if (navbar) navbar.style.display = 'block'; // Restore default block display
    if (footer) footer.style.display = 'none';
    if (adminBanner) adminBanner.style.display = 'none';
    if (categoryTabs) categoryTabs.style.display = 'none';
    if (categoryTabsClone) categoryTabsClone.style.display = 'none';
    if (heroSection) heroSection.style.display = 'none';

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
                <tr style="border-bottom: 1px solid #eee;">
                    <td style="padding: 1.2rem 0; display: flex; align-items: center; gap: 1rem;">
                        <img src="${imageUrl}" alt="${item.name}" style="width: 50px; height: 50px; object-fit: cover; border-radius: 4px; border: 1px solid #eee;">
                        <div>
                            <div style="font-weight: 600; color: #2d3436;">${item.name}</div>
                            <div style="font-size: 0.8rem; color: #636e72; margin-top: 2px;">SKU: ${item.id || 'N/A'}</div>
                        </div>
                    </td>
                    <td style="padding: 1.2rem 0; text-align: center; color: #2d3436;">${item.qty}</td>
                    <td style="padding: 1.2rem 0; text-align: right; color: #2d3436;">৳${(item.price || 0).toFixed(2)}</td>
                    <td style="padding: 1.2rem 0; text-align: right; font-weight: 600; color: #2d3436;">৳${((item.price || 0) * item.qty).toFixed(2)}</td>
                </tr>
            `;
        });

        invoiceContainer.innerHTML = `
            <div style="display: flex; justify-content: space-between; align-items: flex-start; margin-bottom: 4rem;">
                <div>
                    <img src="assets/tc_logo.png" alt="Toy & Craft" style="height: 60px; margin-bottom: 1rem;">
                    <h1 style="font-size: 2rem; margin: 0; color: #007BFF; letter-spacing: -1px;">Toy & Craft</h1>
                    <p style="color: #636e72; font-size: 0.9rem; margin-top: 5px;">Premium Mini Bricks & Keyrings</p>
                </div>
                <div style="text-align: right;">
                    <h2 style="font-size: 2.5rem; margin: 0; color: #eee; text-transform: uppercase;">Invoice</h2>
                    <p style="font-weight: 700; color: #2d3436; margin: 5px 0;">#${orderId}</p>
                    <span class="status-badge ${statusBadgeClass}" style="display: inline-block; margin-top: 10px;">${data.status || 'Pending'}</span>
                </div>
            </div>

            <div style="display: grid; grid-template-columns: 1fr 1fr; gap: 4rem; margin-bottom: 4rem;">
                <div>
                    <h3 style="text-transform: uppercase; font-size: 0.75rem; color: #b2bec3; letter-spacing: 1px; margin-bottom: 1rem; border-bottom: 2px solid #007BFF; width: fit-content; padding-bottom: 4px;">Billing To</h3>
                    <div style="font-weight: 700; font-size: 1.1rem; color: #2d3436;">${data.username}</div>
                    <div style="color: #636e72; font-size: 0.9rem; margin-top: 5px; line-height: 1.5;">
                        ${data.address}<br>
                        ${data.thana || ''}, ${data.district || ''}<br>
                        Phone: ${data.mobile || 'N/A'}<br>
                        ID: ${data.userId}
                    </div>
                </div>
                <div style="text-align: right;">
                    <h3 style="text-transform: uppercase; font-size: 0.75rem; color: #b2bec3; letter-spacing: 1px; margin-bottom: 1rem; border-bottom: 2px solid #007BFF; width: fit-content; padding-bottom: 4px; margin-left: auto;">Order Info</h3>
                    <p style="margin: 5px 0; color: #636e72;">Date: <strong style="color: #2d3436;">${dateStr}</strong></p>
                    <p style="margin: 5px 0; color: #636e72;">Payment: <strong style="color: #2d3436;">Cash on Delivery</strong></p>
                </div>
            </div>

            <table style="width: 100%; border-collapse: collapse; margin-bottom: 3rem;">
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

            <div style="display: flex; justify-content: flex-end;">
                <div style="width: 300px;">
                    <div style="display: flex; justify-content: space-between; padding: 0.5rem 0; color: #636e72;">
                        <span>Subtotal</span>
                        <span>৳${(data.totalPrice - (data.deliveryCharge || 0)).toFixed(2)}</span>
                    </div>
                    <div style="display: flex; justify-content: space-between; padding: 0.5rem 0; color: #636e72;">
                        <span>Delivery Charge</span>
                        <span>৳${(data.deliveryCharge || 0).toFixed(2)}</span>
                    </div>
                    <div style="display: flex; justify-content: space-between; padding: 1rem 0; border-top: 2px solid #eee; margin-top: 0.5rem; font-size: 1.4rem; font-weight: 800; color: #007BFF;">
                        <span>Grand Total</span>
                        <span>৳${(data.totalPrice || 0).toFixed(2)}</span>
                    </div>
                </div>
            </div>

            <div style="margin-top: 6rem; padding-top: 2rem; border-top: 1px solid #eee; display: flex; justify-content: space-between; align-items: center;">
                <div>
                    <h4 style="margin: 0; color: #2d3436;">Thank you for your purchase!</h4>
                    <p style="color: #636e72; font-size: 0.8rem; margin-top: 4px;">For any queries, contact us via Messenger or WhatsApp.</p>
                </div>
                <div style="text-align: right;">
                    <p style="font-weight: 700; color: #2d3436; margin: 0;">Toy & Craft</p>
                    <p style="color: #636e72; font-size: 0.8rem; margin-top: 2px;">toyandcraft.shop</p>
                </div>
            </div>
        `;

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
