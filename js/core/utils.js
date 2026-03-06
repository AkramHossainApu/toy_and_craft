import { state } from './state.js';
import { errorViewSection, errorMessageText, shopSection, productViewSection, checkoutView, adminOrdersView, mainLayoutContainer, cartToggleBtn, authLoginBtn, userProfileBadge } from './dom.js';

// --- Utility Functions ---

export function generateSlug(name) {
    if (!name) return '';
    return name.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/(^-|-$)/g, '');
}

export function getAbsoluteImageUrl(img) {
    if (!img) return 'assets/placeholder.jpg';
    if (img.startsWith('http') || img.startsWith('//') || img.startsWith('data:')) return img;
    return img.startsWith('/') ? img : '/' + img;
}

export function showErrorPage(message) {
    if (shopSection) shopSection.style.display = 'none';
    if (productViewSection) productViewSection.style.display = 'none';
    if (checkoutView) checkoutView.style.display = 'none';
    if (adminOrdersView) adminOrdersView.style.display = 'none';

    // Ensure the main layout container is visible so the error section inside it can be seen
    if (mainLayoutContainer) mainLayoutContainer.style.display = 'block';

    // Hide nav actions
    if (cartToggleBtn) cartToggleBtn.style.display = 'none';
    if (authLoginBtn) authLoginBtn.style.display = 'none';
    if (userProfileBadge) userProfileBadge.style.display = 'none';

    if (errorViewSection) {
        errorViewSection.style.display = 'flex';
        if (message) {
            errorMessageText.textContent = message;
        } else {
            errorMessageText.textContent = "The page or product you are looking for doesn't exist or has been moved.";
        }
    }
}

// Ensure error handler is attached to window for direct HTML onclick events (e.g. 404 page buttons)
window.showErrorPage = showErrorPage;
