/**
 * Steadfast Courier API — Client-side configuration
 * All API calls go through the proxy to keep keys secure.
 */

// Proxy base URL — same origin for local dev, external URL for production
const PROXY_BASE = window.location.hostname === 'localhost'
    ? ''  // server.py handles it on same origin
    : '';  // TODO: Set your deployed proxy URL here (e.g. 'https://your-proxy.onrender.com')

/**
 * Create a Steadfast delivery parcel for an order.
 * @param {Object} orderData - { invoice, recipient_name, recipient_phone, recipient_address, cod_amount, note?, item_description? }
 * @returns {Object} - { success, consignment_id?, tracking_code?, error? }
 */
export async function createSteadfastOrder(orderData) {
    try {
        const res = await fetch(`${PROXY_BASE}/api/steadfast/create-order`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(orderData)
        });

        const data = await res.json();

        if (res.ok && data.consignment) {
            return {
                success: true,
                consignment_id: data.consignment.consignment_id,
                tracking_code: data.consignment.tracking_code,
                steadfast_status: data.consignment.status || 'in_review'
            };
        } else {
            console.warn('Steadfast order creation failed:', data);
            return { success: false, error: data.message || data.error || 'Unknown error' };
        }
    } catch (err) {
        console.error('Steadfast API call failed:', err);
        return { success: false, error: err.message };
    }
}

/**
 * Track a delivery by invoice ID.
 * @param {string} invoiceId
 * @returns {Object} - { success, delivery_status?, error? }
 */
export async function trackByInvoice(invoiceId) {
    try {
        const res = await fetch(`${PROXY_BASE}/api/steadfast/track/${encodeURIComponent(invoiceId)}`);
        const data = await res.json();

        if (res.ok && data.delivery_status) {
            return { success: true, delivery_status: data.delivery_status };
        } else {
            return { success: false, error: data.error || 'Status not found' };
        }
    } catch (err) {
        console.error('Tracking API call failed:', err);
        return { success: false, error: err.message };
    }
}

/**
 * Track a delivery by tracking code.
 * @param {string} trackingCode
 * @returns {Object} - { success, delivery_status?, error? }
 */
export async function trackByCode(trackingCode) {
    try {
        const res = await fetch(`${PROXY_BASE}/api/steadfast/track-by-code/${encodeURIComponent(trackingCode)}`);
        const data = await res.json();

        if (res.ok && data.delivery_status) {
            return { success: true, delivery_status: data.delivery_status };
        } else {
            return { success: false, error: data.error || 'Status not found' };
        }
    } catch (err) {
        console.error('Tracking API call failed:', err);
        return { success: false, error: err.message };
    }
}

/**
 * Get a human-readable label and color for a Steadfast status.
 * @param {string} status
 * @returns {Object} - { label, color, emoji }
 */
export function getStatusDisplay(status) {
    const map = {
        'in_review':                        { label: 'In Review',              color: '#f39c12', emoji: '📋' },
        'pending':                          { label: 'Pending',                color: '#e67e22', emoji: '⏳' },
        'delivered':                        { label: 'Delivered',              color: '#27ae60', emoji: '✅' },
        'delivered_approval_pending':       { label: 'Delivered (Verifying)',   color: '#2ecc71', emoji: '🔄' },
        'partial_delivered':                { label: 'Partially Delivered',    color: '#3498db', emoji: '📦' },
        'partial_delivered_approval_pending':{ label: 'Partial (Verifying)',    color: '#2980b9', emoji: '🔄' },
        'cancelled':                        { label: 'Cancelled',              color: '#e74c3c', emoji: '❌' },
        'cancelled_approval_pending':       { label: 'Cancelling',             color: '#c0392b', emoji: '🔄' },
        'hold':                             { label: 'On Hold',                color: '#9b59b6', emoji: '⏸️' },
        'unknown':                          { label: 'Unknown',                color: '#95a5a6', emoji: '❓' },
        'unknown_approval_pending':         { label: 'Unknown (Pending)',       color: '#7f8c8d', emoji: '❓' },
    };
    return map[status] || { label: status || 'Unknown', color: '#95a5a6', emoji: '❓' };
}
