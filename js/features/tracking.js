import { state } from '../core/state.js';
import { db, collection, query, where, getDocs, doc, updateDoc } from '../config/firebase.js';
import { trackByInvoice, getStatusDisplay } from '../config/steadfast.js';
import { mainContent, errorViewSection } from '../core/dom.js';

/**
 * Normalizes Steadfast status string into our native Firebase status strings.
 */
function mapSteadfastStatusToNative(steadfastStatusStr) {
    if (!steadfastStatusStr) return null;
    const raw = steadfastStatusStr.toLowerCase();
    
    if (raw === 'in_review') return 'Pending';
    if (raw === 'pending') return 'Sent';
    if (raw.includes('approval') || raw.includes('delivered')) return 'Delivered';
    if (raw.includes('cancelled')) return 'Cancelled';
    
    return null;
}

export async function refreshTrackingBadge() {
    const trackBtn = document.getElementById('nav-track-btn');
    if (!trackBtn) return;

    let activeOrdersCount = 0;
    let localGuestOrders = [];
    
    try {
        localGuestOrders = JSON.parse(localStorage.getItem('tc_guest_orders')) || [];
    } catch(e) {}

    if (state.currentUser) {
        // Query user's active orders from Firestore
        try {
            const q1 = query(collection(db, 'Orders'), where('userId', '==', state.currentUser.id), where('status', '==', 'Pending'));
            const q1Snap = await getDocs(q1);
            
            const q2 = query(collection(db, 'Orders'), where('userId', '==', state.currentUser.id), where('status', '==', 'Sent'));
            const q2Snap = await getDocs(q2);
            
            activeOrdersCount = q1Snap.size + q2Snap.size;
        } catch(e) { console.error("Error fetching active orders for badge:", e); }
    } else {
        // Evaluate local guest orders
        const activeGuests = localGuestOrders.filter(o => o.status === 'Pending' || o.status === 'Sent');
        activeOrdersCount = activeGuests.length;
    }

    // Hide or show
    if (activeOrdersCount > 0) {
        trackBtn.style.display = 'inline-block';
        
        let badge = document.getElementById('track-badge');
        if (!badge) {
            trackBtn.insertAdjacentHTML('beforeend', `<span class="cart-badge" id="track-badge" style="background: #e74c3c;">${activeOrdersCount}</span>`);
            badge = document.getElementById('track-badge');
        }
        badge.style.display = 'block';
        badge.textContent = activeOrdersCount;
    } else {
        trackBtn.style.display = 'none';
        const badge = document.getElementById('track-badge');
        if (badge) badge.style.display = 'none';
    }
}

export function initTracking() {
    const trackBtn = document.getElementById('nav-track-btn');
    const trackView = document.getElementById('track-view');

    if (trackBtn) {
        trackBtn.addEventListener('click', () => {
             // Basic view resetting
            if (mainContent) mainContent.style.display = 'block';
            if (errorViewSection) errorViewSection.style.display = 'none';
            const shopSection = document.getElementById('shop');
            const productView = document.getElementById('product-view');
            if (shopSection) shopSection.style.display = 'none';
            if (productView) productView.style.display = 'none';
            
            // Build the tracking page dynamically
            renderActiveOrdersView(trackView);
            trackView.style.display = 'flex';
            
            if (window.history.pushState) window.history.pushState({ path: '/track' }, '', '/track');
        });
    }

    // Check on startup
    refreshTrackingBadge();
}

async function renderActiveOrdersView(container) {
    container.innerHTML = `
        <span class="material-icons-round" style="font-size: 60px; color: var(--text-muted); margin-bottom: 1rem;">local_shipping</span>
        <h2 style="font-family: var(--font-heading); font-size: 2.5rem; margin-bottom: 0.5rem; color: var(--text-main);">Live Tracking</h2>
        <p style="color: var(--text-muted); font-size: 1.1rem; margin-bottom: 2rem;">Real-time updates on your active shipments.</p>
        <div id="live-orders-container" style="width: 100%; max-width: 800px; text-align: left;">
            <div style="text-align:center; padding: 2rem;"><span class="material-icons-round rotate-anim">autorenew</span> Fetching live statuses...</div>
        </div>
    `;

    const listContainer = document.getElementById('live-orders-container');
    let activeOrders = [];
    
    // Fetch appropriate order list
    if (state.currentUser) {
        try {
            const q1 = query(collection(db, 'Orders'), where('userId', '==', state.currentUser.id), where('status', '==', 'Pending'));
            const q1Snap = await getDocs(q1);
            const q2 = query(collection(db, 'Orders'), where('userId', '==', state.currentUser.id), where('status', '==', 'Sent'));
            const q2Snap = await getDocs(q2);
            
            q1Snap.forEach(doc => activeOrders.push({ id: doc.id, ...doc.data() }));
            q2Snap.forEach(doc => activeOrders.push({ id: doc.id, ...doc.data() }));
        } catch(e) {}
    } else {
        try {
            const guestOrders = JSON.parse(localStorage.getItem('tc_guest_orders')) || [];
            activeOrders = guestOrders.filter(o => o.status === 'Pending' || o.status === 'Sent');
        } catch(e) {}
    }

    if (activeOrders.length === 0) {
        listContainer.innerHTML = `
            <div style="padding: 2rem; background: var(--bg-card); border: 1px dashed var(--border-color); border-radius: 12px; text-align: center;">
                <p style="color: var(--text-muted); margin: 0;">You have no active orders currently out for delivery.</p>
            </div>
        `;
        refreshTrackingBadge(); // Make sure the icon is hidden
        return;
    }

    // Ping Steadfast API and Sync
    let htmlContent = '';
    let stateChanged = false;

    // Sort by latest first if we assume descending ID or just randomly
    activeOrders.sort((a,b) => String(b.id).localeCompare(String(a.id)));

    for (const order of activeOrders) {
        // Fetch Live Steadfast Data
        const sfResult = await trackByInvoice(order.id);
        let sfStatusObj = null;
        let nativeEquivalent = order.status;
        let trackingNum = 'N/A';

        if (sfResult.success) {
            sfStatusObj = getStatusDisplay(sfResult.delivery_status);
            trackingNum = sfResult.tracking_code || trackingNum;
            const computedNative = mapSteadfastStatusToNative(sfResult.delivery_status);
            
            // Sync Firebase if the mapped status differs!
            if (computedNative && computedNative !== order.status) {
                nativeEquivalent = computedNative; // Website local logic
                if (state.currentUser) {
                    try {
                        const orderRef = doc(db, 'Orders', order.id);
                        await updateDoc(orderRef, { status: nativeEquivalent });
                        const userOrderRef = doc(db, 'Users', state.currentUser.id, 'Orders', order.id);
                        await updateDoc(userOrderRef, { status: nativeEquivalent });
                    } catch(e) { console.warn("Background Steadfast -> Firebase sync failed", e); }
                } else {
                   // Guest Sync
                   try {
                        let guestOrders = JSON.parse(localStorage.getItem('tc_guest_orders')) || [];
                        const match = guestOrders.find(o => o.id === order.id);
                        if (match) { match.status = nativeEquivalent; }
                        localStorage.setItem('tc_guest_orders', JSON.stringify(guestOrders));
                   } catch(e) {}
                }
                stateChanged = true;
            }
        } else {
            // Steadfast error or hasn't propagated to their system yet (rare)
            sfStatusObj = { label: 'Processing at warehouse', color: '#95a5a6', emoji: '📦' };
        }

        // Only display if the native status isn't "Delivered". 
        // We sync Delivered above, so if it just became Delivered, we can either skip it or show it. Let's show it so they see it reached 100%!
        if (nativeEquivalent === 'Cancelled') continue;

        htmlContent += renderOrderCard(order.id, trackingNum, sfStatusObj, nativeEquivalent);
    }
    
    if (htmlContent === '') {
        listContainer.innerHTML = '<div style="text-align:center; padding:1rem; color:var(--text-muted);">All known shipments have arrived!</div>';
    } else {
        listContainer.innerHTML = htmlContent;
    }

    if (stateChanged) refreshTrackingBadge();
}

/** Function replacing generic timeline renderer with dynamic component */
function renderOrderCard(invoiceId, trackingCode, sfStatusObj, nativeStatus) {
    // nativeStatus is: Pending, Sent, Delivered. 
    // We can map these natively to 4 steps: 
    // step 1: Pending (Processing warehouse)
    // step 2: Sent (Steadfast In Review)
    // step 3: Sent (Actually On The Way -> sfStatusObj says partially delivered or out etc)
    // step 4: Delivered
    
    // Determine active step (1 to 4) based on Steadfast mapping:
    let currentStep = 1;
    if (nativeStatus === 'Sent') currentStep = 2; // Default generic sent
    
    // Fine tune step 3 using detailed sf status text
    if (nativeStatus === 'Sent' && sfStatusObj.label !== 'Pending' && sfStatusObj.label !== 'In Review') {
        currentStep = 3; // "Dispatched or out"
    }
    if (nativeStatus === 'Delivered') currentStep = 4;

    const stepColor = currentStep === 4 ? '#27ae60' : '#007BFF';

    const steps = [
        { icon: 'receipt', label: 'Order Received' },
        { icon: 'inventory_2', label: 'Processing' },
        { icon: 'local_shipping', label: 'On The Way' },
        { icon: 'home', label: 'Delivered' }
    ];

    let html = `
        <div style="background: var(--bg-card); border: 1px solid var(--border-color); border-radius: 12px; padding: 1.5rem; margin-bottom: 1.5rem; box-shadow: 0 4px 15px rgba(0,0,0,0.03);">
            <div style="display: flex; justify-content: space-between; align-items: flex-start; margin-bottom: 2rem; flex-wrap: wrap; gap: 1rem; border-bottom: 1px dashed var(--border-color); padding-bottom: 1.5rem;">
                <div>
                    <h3 style="margin: 0 0 6px; color: var(--text-main); font-family: var(--font-heading); font-size: 1.25rem;">Invoice #${invoiceId}</h3>
                    <div style="font-size: 0.9rem; color: var(--text-muted);"><span class="material-icons-round" style="font-size:14px; vertical-align:middle;">qr_code</span> ${trackingCode === 'N/A' ? 'Tracking soon' : trackingCode}</div>
                </div>
                <div style="background: ${sfStatusObj.color}15; color: ${sfStatusObj.color}; padding: 6px 14px; border-radius: 6px; font-weight: 600; font-size: 0.9rem; display: inline-flex; align-items: center; gap: 6px;">
                    ${sfStatusObj.emoji} ${sfStatusObj.label} 
                </div>
            </div>

            <!-- Visual Timeline -->
            <div style="display: flex; justify-content: space-between; position: relative; margin: 2rem 0 1rem; max-width: 100%; overflow-x: auto; padding-bottom: 10px;">
    `;
    
    // Line BG
    html += `<div style="position: absolute; top: 18px; left: 10%; right: 10%; height: 4px; background: #eef1f5; z-index: 1;"></div>`;
    // Active Line
    const progressWidth = currentStep === 1 ? '0%' : currentStep === 2 ? '33%' : currentStep === 3 ? '66%' : '100%';
    html += `<div style="position: absolute; top: 18px; left: 10%; width: ${progressWidth}; height: 4px; background: ${stepColor}; z-index: 2; transition: width 1s ease;"></div>`;

    steps.forEach((step, index) => {
        const stepNum = index + 1;
        const isActive = currentStep >= stepNum;
        const isCurrent = currentStep === stepNum;
        
        const circleBg = isActive ? stepColor : '#fff';
        const circleBorder = isActive ? stepColor : '#cbd5e1';
        const iconColor = isActive ? '#fff' : '#94a3b8';
        const textColor = isCurrent ? 'var(--text-main)' : isActive ? 'var(--text-main)' : 'var(--text-muted)';
        const fontWeight = isCurrent ? '700' : '500';

        html += `
            <div style="display: flex; flex-direction: column; align-items: center; position: relative; z-index: 3; width: 75px;">
                <div style="width: 40px; height: 40px; border-radius: 50%; background: ${circleBg}; border: 3px solid ${circleBorder}; display: flex; align-items: center; justify-content: center; margin-bottom: 8px; box-shadow: ${isCurrent ? '0 0 0 4px ' + stepColor + '25' : 'none'};">
                    <span class="material-icons-round" style="color: ${iconColor}; font-size: 20px;">${step.icon}</span>
                </div>
                <div style="font-size: 0.75rem; font-weight: ${fontWeight}; color: ${textColor}; text-align: center; line-height: 1.2;">
                    ${step.label}
                </div>
            </div>
        `;
    });

    html += `
            </div>
        </div>
    `;

    return html;
}
