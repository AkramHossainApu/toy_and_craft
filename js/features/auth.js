import { state, updateCart, setAdmin } from '../core/state.js';
import { db, doc, getDoc, setDoc, updateDoc, deleteDoc, collection, query, where, getDocs, writeBatch } from '../config/firebase.js';
import {
    authLoginBtn, userProfileBadge, cartToggleBtn, adminNavbarLogoutBtn, userProfileName,
    loginForm, registerForm, profileForm, authModalTitle, loginView, registerView, profileView,
    profileUsernameInput, profileUseridInput, profileMobileInput, profileAddressInput, profileDistrictInput, profileThanaInput,
    authModal, showRegisterBtn, showLoginBtn, authLogoutBtn, loginIdentifierInput, loginPasswordInput, loginRememberInput, loginSubmitBtn,
    registerUsernameInput, registerUseridInput, registerMobileInput, registerMobileHint, registerPasswordInput, registerAddressInput, registerDistrictInput, registerThanaInput, registerRememberInput, registerSubmitBtn,
    profileUpdateBtn, closeAuthModalBtn, profileOrdersList, profileMobileHint,
    // Email & OTP Elements
    registerEmailInput, registerEmailHint, registerGetOtpBtn, registerOtpSection, registerOtpInput,
    registerOtpHint, registerResendOtpBtn, registerOtpTimer, registerHiddenFields, registerGetOtpWrapper, registerEmailGroup,
    // Forgot Password Elements
    forgotPasswordView, forgotEmailInput, forgotEmailHint, forgotGetOtpBtn, forgotOtpSection,
    forgotOtpInput, forgotOtpHint, forgotResendOtpBtn, forgotOtpTimer, forgotNewPasswordSection,
    forgotNewPasswordInput, forgotConfirmPasswordInput, forgotSubmitBtn, forgotGetOtpWrapper, forgotEmailGroup,
    showForgotPasswordBtn, showLoginFromForgotBtn,
    // Profile Email & OTP Elements
    profileEmailInput, profileChangeEmailBtn, profileEmailHint, profileGetOtpBtn, profileOtpSection,
    profileOtpInput, profileOtpHint, profileResendOtpBtn, profileOtpTimer, profileGetOtpWrapper, profileEmailGroup
} from '../core/dom.js';
import { generateSlug } from '../core/utils.js';
import { refreshTrackingBadge } from './tracking.js';

// =============================================
// EmailJS Configuration — UPDATE THESE VALUES
// =============================================
const EMAILJS_PUBLIC_KEY = 'OjiCre7MrMd4cQykO';    // Updated with user's key
const EMAILJS_SERVICE_ID = 'service_ae64ka8';    // Updated with user's service ID
const EMAILJS_TEMPLATE_ID = 'template_cgls9sh';  // Updated with user's template ID

// OTP State (in-memory, per session)
const otpState = {
    register: { code: null, expiry: null, timer: null, email: null },
    forgot: { code: null, expiry: null, timer: null, email: null },
    profile: { code: null, expiry: null, timer: null, email: null }
};

// =============================================
// Cloudflare Turnstile Reset Function
// =============================================
function resetTurnstile() {
    window.isLoginTurnstilePassed = false;
    window.isRegisterTurnstilePassed = false;
    window.isAdminTurnstilePassed = false;
    if (loginSubmitBtn) loginSubmitBtn.disabled = true;
    if (registerGetOtpBtn) registerGetOtpBtn.disabled = true;
    const adminBtn = document.getElementById('password-submit-btn');
    if (adminBtn) adminBtn.disabled = true;
    if (typeof turnstile !== 'undefined') {
        try { turnstile.reset(); } catch (e) { console.warn("Turnstile reset error", e); }
    }
}
window.resetTurnstile = resetTurnstile;

// =============================================
// Email Validation Helper
// =============================================
function validateEmail(email, hintEl) {
    email = email.trim().toLowerCase();
    if (!email) {
        hintEl.textContent = 'Email is required.';
        hintEl.style.color = 'var(--text-muted)';
        return false;
    }
    if (email.endsWith('.edu')) {
        hintEl.textContent = '⚠ Please don\'t use a student email. Use a normal email (e.g. @gmail.com).';
        hintEl.style.color = '#f59e0b';
        return false;
    }
    if (email.endsWith('@gmail.com')) {
        hintEl.textContent = '✓ Valid Gmail address.';
        hintEl.style.color = '#28a745';
        return true;
    }
    // Anything else
    hintEl.textContent = '✗ Invalid email. Please use a valid Gmail address (@gmail.com).';
    hintEl.style.color = '#ff4444';
    return false;
}

// =============================================
// OTP Generation, Sending & Verification
// =============================================
function generateOTP() {
    return Math.floor(100000 + Math.random() * 900000).toString();
}

function startOtpTimer(context, timerEl, resendBtn) {
    let remaining = 5 * 60; // 5 minutes in seconds
    resendBtn.disabled = true;

    // Clear any existing timer
    if (otpState[context].timer) clearInterval(otpState[context].timer);

    const updateDisplay = () => {
        const min = Math.floor(remaining / 60);
        const sec = remaining % 60;
        timerEl.textContent = `⏱ ${min}:${sec.toString().padStart(2, '0')}`;
        timerEl.style.color = remaining <= 60 ? '#ff4444' : 'var(--primary)';
    };
    updateDisplay();

    otpState[context].timer = setInterval(() => {
        remaining--;
        updateDisplay();
        if (remaining <= 0) {
            clearInterval(otpState[context].timer);
            otpState[context].code = null;
            timerEl.textContent = '⏱ Expired';
            timerEl.style.color = '#ff4444';
            resendBtn.disabled = false;
        }
        // Enable resend after 30 seconds
        if (remaining <= (5 * 60 - 30)) {
            resendBtn.disabled = false;
        }
    }, 1000);
}

async function sendOtpEmail(toEmail, otpCode) {
    try {
        // Initialize EmailJS if not already done
        if (window.emailjs) {
            window.emailjs.init(EMAILJS_PUBLIC_KEY);
        } else {
            console.error('EmailJS SDK not loaded.');
            return false;
        }

        const response = await window.emailjs.send(EMAILJS_SERVICE_ID, EMAILJS_TEMPLATE_ID, {
            to_email: toEmail,
            otp_code: otpCode,
            expiry_minutes: '5'
        });
        
        console.log('EmailJS Success:', response.status, response.text);
        return true;
    } catch (err) {
        console.error('EmailJS Error:', err);
        return false;
    }
}

function setupOtpFlow(context, {
    emailInput, emailHint, getOtpBtn, getOtpWrapper, emailGroup,
    otpSection, otpInput, otpHint, resendBtn, timerEl,
    onVerified
}) {
    if (!emailInput || !getOtpBtn || !otpInput) return;

    // Email real-time validation
    emailInput.addEventListener('input', () => {
        const isValid = validateEmail(emailInput.value, emailHint);
        getOtpBtn.disabled = !isValid;
    });

    // Get OTP button
    getOtpBtn.addEventListener('click', async () => {
        const email = emailInput.value.trim().toLowerCase();
        if (!validateEmail(email, emailHint)) return;

        getOtpBtn.disabled = true;
        getOtpBtn.textContent = 'Sending OTP...';

        const otp = generateOTP();
        otpState[context].code = otp;
        otpState[context].expiry = Date.now() + 5 * 60 * 1000;
        otpState[context].email = email;

        const sent = await sendOtpEmail(email, otp);

        if (sent) {
            getOtpWrapper.style.display = 'none';
            otpSection.style.display = 'block';
            otpInput.value = '';
            otpInput.focus();
            otpHint.textContent = 'Check your Gmail inbox for the verification code.';
            otpHint.style.color = 'var(--text-muted)';
            startOtpTimer(context, timerEl, resendBtn);
        } else {
            emailHint.textContent = '✗ Failed to send OTP. Please try again.';
            emailHint.style.color = '#ff4444';
            getOtpBtn.disabled = false;
            getOtpBtn.textContent = 'Get OTP';
        }
    });

    // Resend OTP
    if (resendBtn) {
        resendBtn.addEventListener('click', async () => {
            const email = otpState[context].email;
            if (!email) return;

            resendBtn.disabled = true;
            resendBtn.textContent = 'Sending...';

            const otp = generateOTP();
            otpState[context].code = otp;
            otpState[context].expiry = Date.now() + 5 * 60 * 1000;

            const sent = await sendOtpEmail(email, otp);

            if (sent) {
                otpHint.textContent = '✓ New OTP sent! Check your inbox.';
                otpHint.style.color = '#28a745';
                otpInput.value = '';
                otpInput.focus();
                startOtpTimer(context, timerEl, resendBtn);
            } else {
                otpHint.textContent = '✗ Failed to resend. Try again shortly.';
                otpHint.style.color = '#ff4444';
            }
            resendBtn.textContent = 'Resend OTP';
        });
    }

    // Real-time OTP verification (auto-verify when 6 digits entered)
    otpInput.addEventListener('input', () => {
        otpInput.value = otpInput.value.replace(/[^0-9]/g, '');

        if (otpInput.value.length === 6) {
            if (!otpState[context].code || Date.now() > otpState[context].expiry) {
                otpHint.textContent = '✗ OTP has expired. Please request a new one.';
                otpHint.style.color = '#ff4444';
                return;
            }
            if (otpInput.value === otpState[context].code) {
                otpHint.textContent = '✓ Email verified successfully!';
                otpHint.style.color = '#28a745';
                otpInput.disabled = true;
                otpInput.style.borderColor = '#28a745';
                if (resendBtn) resendBtn.disabled = true;
                if (otpState[context].timer) clearInterval(otpState[context].timer);
                if (timerEl) {
                    timerEl.textContent = '✓ Verified';
                    timerEl.style.color = '#28a745';
                }

                setTimeout(() => onVerified(otpState[context].email), 400);
            } else {
                otpHint.textContent = '✗ Incorrect OTP. Please try again.';
                otpHint.style.color = '#ff4444';
            }
        }
    });
}

// Reset OTP form state
function resetOtpUI(context, {
    emailGroup, emailInput, emailHint, getOtpBtn, getOtpWrapper,
    otpSection, otpInput, otpHint, resendBtn, timerEl
}) {
    if (otpState[context] && otpState[context].timer) clearInterval(otpState[context].timer);
    otpState[context] = { code: null, expiry: null, timer: null, email: null };

    if (emailGroup) emailGroup.style.display = 'block';
    if (getOtpWrapper) getOtpWrapper.style.display = context === 'profile' ? 'none' : 'block';
    if (emailInput) emailInput.value = '';
    if (emailHint) {
        emailHint.textContent = context === 'register' ? 'Only Gmail addresses are accepted.' : 'Enter your registered Gmail address.';
        emailHint.style.color = 'var(--text-muted)';
    }
    if (getOtpBtn) {
        getOtpBtn.disabled = true;
        getOtpBtn.textContent = 'Get OTP';
    }

    if (otpSection) otpSection.style.display = 'none';
    if (otpInput) {
        otpInput.value = '';
        otpInput.disabled = false;
        otpInput.style.borderColor = '';
    }
    if (otpHint) {
        otpHint.textContent = 'Check your Gmail inbox for the verification code.';
        otpHint.style.color = 'var(--text-muted)';
    }
    if (timerEl) {
        timerEl.textContent = '⏱ 5:00';
        timerEl.style.color = 'var(--primary)';
    }
    if (resendBtn) {
        resendBtn.disabled = true;
        resendBtn.textContent = 'Resend OTP';
    }
}

// --- User Authentication & Profile Logic ---

export function updateAuthUI() {
    // If admin is active, strictly hide the login button no matter what
    if (state.isAdmin) {
        if (authLoginBtn) authLoginBtn.style.display = 'none';
        if (userProfileBadge) userProfileBadge.style.display = 'none';
        if (cartToggleBtn) cartToggleBtn.style.display = 'none';
        if (adminNavbarLogoutBtn) adminNavbarLogoutBtn.style.display = 'block';
        return;
    }

    // Reset standard generic views if not admin
    if (cartToggleBtn) cartToggleBtn.style.display = 'flex';
    if (adminNavbarLogoutBtn) adminNavbarLogoutBtn.style.display = 'none';

    if (state.currentUser) {
        if (authLoginBtn) authLoginBtn.style.display = 'none';
        if (userProfileBadge) {
            userProfileBadge.style.display = 'flex';
            userProfileName.textContent = state.currentUser.name || state.currentUser.id;
        }
    } else {
        if (authLoginBtn) authLoginBtn.style.display = 'block';
        if (userProfileBadge) userProfileBadge.style.display = 'none';
        // Enforce path fallback if session expires or logs out, preserving current view
        if (state.routingInitialized && state.categories.length > 0) {
            if (window.currentViewedProduct && window.shopSection && window.shopSection.style.display === 'none') {
                window.updateUrlState(state.currentCategorySlug, state.currentPage, window.currentViewedProduct.slug);
            } else if (window.updateUrlState) {
                window.updateUrlState(state.currentCategorySlug, state.currentPage);
            }
        }
    }
}

export function initLocationDropdowns() {
    console.log("AUTH.JS: initLocationDropdowns triggered. Locations count:", Object.keys(state.steadfastLocations).length);
    if (Object.keys(state.steadfastLocations).length === 0) {
        console.warn("AUTH.JS: Aborting dropdown init because SteadfastLocations is empty.");
        return;
    }

    const districts = Object.keys(state.steadfastLocations).filter(d => d !== "Dhaka City" && d !== "Dhaka Sub-Urban");
    districts.push("Dhaka");
    districts.sort();

    const populateDistrict = (selectEl) => {
        if (!selectEl) return;
        // Preserve empty first option
        selectEl.innerHTML = '<option value="" disabled selected>Select District</option>';
        districts.forEach(d => {
            const opt = document.createElement('option');
            opt.value = d;
            opt.textContent = d;
            selectEl.appendChild(opt);
        });
    };

    const regDist = document.getElementById('register-district');
    const regThana = document.getElementById('register-thana');
    const profDist = document.getElementById('profile-district');
    const profThana = document.getElementById('profile-thana');

    populateDistrict(regDist);
    populateDistrict(profDist);

    const handleDistrictChange = (thanaSelectEl) => (e) => {
        if (!thanaSelectEl) return;
        const selected = e.target.value;
        thanaSelectEl.innerHTML = '<option value="" disabled selected>Select Thana</option>';
        thanaSelectEl.disabled = false;
        thanaSelectEl.style.background = 'var(--bg-card)';
        thanaSelectEl.style.cursor = 'pointer';

        let thanas = [];
        if (selected === "Dhaka") {
            thanas = [...(state.steadfastLocations["Dhaka City"] || []), ...(state.steadfastLocations["Dhaka Sub-Urban"] || [])];
        } else if (state.steadfastLocations[selected]) {
            thanas = state.steadfastLocations[selected];
        }

        thanas.sort().forEach(t => {
            const opt = document.createElement('option');
            opt.value = t;
            opt.textContent = t;
            thanaSelectEl.appendChild(opt);
        });
    };

    if (regDist && regThana) {
        regDist.addEventListener('change', handleDistrictChange(regThana));
    }
    if (profDist && profThana) {
        profDist.addEventListener('change', handleDistrictChange(profThana));
    }

    // Add input listeners for all profile fields to track changes
    [profileUsernameInput, profileUseridInput, profileEmailInput, profileMobileInput, profileAddressInput].forEach(el => {
        if (el) el.addEventListener('input', checkProfileChanges);
    });
    [profileDistrictInput, profileThanaInput].forEach(el => {
        if (el) el.addEventListener('change', checkProfileChanges);
    });
}

export function checkProfileChanges() {
    if (!profileUpdateBtn || !state.currentUser) return;

    const currentEmail = profileEmailInput.value.trim().toLowerCase();
    const originalEmail = (state.currentUser.email || '').toLowerCase();
    
    // District mapping check
    let currentDistrict = profileDistrictInput.value;
    let originalDistrict = state.currentUser.district || '';
    if (originalDistrict === "Dhaka City" || originalDistrict === "Dhaka Sub-Urban") {
        originalDistrict = "Dhaka";
    }
    const mobileHint = document.getElementById('profile-mobile-hint');
    const isMobileTaken = mobileHint && mobileHint.style.color === 'rgb(255, 68, 68)';

    const hasChanged = 
        profileUsernameInput.value.trim() !== (state.currentUser.name || '') ||
        profileUseridInput.value.trim().toLowerCase() !== (state.currentUser.id || '').toLowerCase() ||
        currentEmail !== originalEmail ||
        profileMobileInput.value.trim() !== (state.currentUser.mobile || '') ||
        profileAddressInput.value.trim() !== (state.currentUser.address || '') ||
        currentDistrict !== originalDistrict ||
        profileThanaInput.value !== (state.currentUser.thana || '');

    profileUpdateBtn.style.display = (hasChanged && !isMobileTaken) ? 'block' : 'none';
}
window.initLocationDropdowns = initLocationDropdowns;

export function openAuthModal(view = 'login') {
    if (loginForm) loginForm.reset();
    if (registerForm) registerForm.reset();
    if (profileForm) profileForm.reset();

    // Reset OTP states when modal opens
    if (registerHiddenFields) registerHiddenFields.style.display = 'none';
    resetOtpUI('register', {
        emailGroup: registerEmailGroup, emailInput: registerEmailInput, emailHint: registerEmailHint,
        getOtpBtn: registerGetOtpBtn, getOtpWrapper: registerGetOtpWrapper,
        otpSection: registerOtpSection, otpInput: registerOtpInput, otpHint: registerOtpHint,
        resendBtn: registerResendOtpBtn, timerEl: registerOtpTimer
    });
    resetOtpUI('forgot', {
        emailGroup: forgotEmailGroup, emailInput: forgotEmailInput, emailHint: forgotEmailHint,
        getOtpBtn: forgotGetOtpBtn, getOtpWrapper: forgotGetOtpWrapper,
        otpSection: forgotOtpSection, otpInput: forgotOtpInput, otpHint: forgotOtpHint,
        resendBtn: forgotResendOtpBtn, timerEl: forgotOtpTimer
    });
    resetOtpUI('profile', {
        emailGroup: profileEmailGroup, emailInput: profileEmailInput, emailHint: profileEmailHint,
        getOtpBtn: profileGetOtpBtn, getOtpWrapper: profileGetOtpWrapper,
        otpSection: profileOtpSection, otpInput: profileOtpInput, otpHint: profileOtpHint,
        resendBtn: profileResendOtpBtn, timerEl: profileOtpTimer
    });

    // Reset visibility for Get OTP wrappers (they should be hidden initially)
    if (registerGetOtpWrapper) registerGetOtpWrapper.style.display = 'none';
    if (forgotGetOtpWrapper) forgotGetOtpWrapper.style.display = 'none';
    if (profileGetOtpWrapper) profileGetOtpWrapper.style.display = 'none';
    if (profileEmailInput) {
        profileEmailInput.readOnly = true;
        profileEmailInput.style.background = 'var(--bg-subtle)';
        profileEmailInput.style.color = 'var(--text-muted)';
        profileEmailInput.style.borderStyle = 'dashed';
    }
    if (profileChangeEmailBtn) {
        profileChangeEmailBtn.textContent = 'Change';
        profileChangeEmailBtn.style.display = 'block';
    }
    if (forgotNewPasswordSection) forgotNewPasswordSection.style.display = 'none';

    if (state.currentUser) {
        if (authModalTitle) authModalTitle.textContent = "Your Profile";
        if (loginView) loginView.style.display = 'none';
        if (registerView) registerView.style.display = 'none';
        if (forgotPasswordView) forgotPasswordView.style.display = 'none';
        if (profileView) profileView.style.display = 'block';

        // Profile Tabs Engine
        const tabDetails = document.getElementById('tab-profile-details');
        const tabOrders = document.getElementById('tab-profile-orders');
        const contentDetails = document.getElementById('profile-details-content');
        const contentOrders = document.getElementById('profile-orders-content');

        if (tabDetails && tabOrders) {
            tabDetails.onclick = () => {
                tabDetails.style.borderBottomColor = 'var(--primary)';
                tabDetails.style.color = 'var(--primary)';
                tabOrders.style.borderBottomColor = 'transparent';
                tabOrders.style.color = 'var(--text-muted)';
                contentDetails.style.display = 'block';
                contentOrders.style.display = 'none';
                if (window.updateUrlState) window.updateUrlState('Details');
            };

            tabOrders.onclick = () => {
                tabOrders.style.borderBottomColor = 'var(--primary)';
                tabOrders.style.color = 'var(--primary)';
                tabDetails.style.borderBottomColor = 'transparent';
                tabDetails.style.color = 'var(--text-muted)';
                contentDetails.style.display = 'none';
                contentOrders.style.display = 'block';
                if (window.loadProfileOrders) window.loadProfileOrders();
                if (window.updateUrlState) window.updateUrlState('Orders');
            };

            tabDetails.click();
        }

        if (profileUsernameInput) profileUsernameInput.value = state.currentUser.name || '';
        if (profileUseridInput) profileUseridInput.value = state.currentUser.id;
        if (profileEmailInput) profileEmailInput.value = state.currentUser.email || '';
        if (profileMobileInput) profileMobileInput.value = state.currentUser.mobile || '';
        if (profileAddressInput) profileAddressInput.value = state.currentUser.address || '';

        if (profileDistrictInput && state.currentUser.district) {
            let mappedDistrict = state.currentUser.district;
            if (mappedDistrict === "Dhaka City" || mappedDistrict === "Dhaka Sub-Urban") {
                mappedDistrict = "Dhaka";
            }
            profileDistrictInput.value = mappedDistrict;
            profileDistrictInput.dispatchEvent(new Event('change'));
            if (profileThanaInput && state.currentUser.thana) {
                profileThanaInput.value = state.currentUser.thana;
            }
        }

        if (window.loadProfileOrders) window.loadProfileOrders();

        // Initial check to hide Update button
        if (profileUpdateBtn) profileUpdateBtn.style.display = 'none';
    } else {
        const hideAll = () => {
            if (loginView) loginView.style.display = 'none';
            if (registerView) registerView.style.display = 'none';
            if (forgotPasswordView) forgotPasswordView.style.display = 'none';
            if (profileView) profileView.style.display = 'none';
        };

        if (view === 'login') {
            hideAll();
            if (authModalTitle) authModalTitle.textContent = "Login";
            if (loginView) loginView.style.display = 'block';
        } else if (view === 'forgot') {
            hideAll();
            if (authModalTitle) authModalTitle.textContent = "Reset Password";
            if (forgotPasswordView) forgotPasswordView.style.display = 'block';
        } else {
            hideAll();
            if (authModalTitle) authModalTitle.textContent = "Register";
            if (registerView) registerView.style.display = 'block';
        }
        if (window.updateUrlState) window.updateUrlState(view);
    }

    if (authModal) {
        authModal.style.display = 'flex';
    }
}
window.openAuthModal = openAuthModal;

export const closeAuthModal = () => {
    if (authModal) authModal.style.display = 'none';
    if (state.currentCategorySlug && window.updateUrlState) window.updateUrlState(state.currentCategorySlug); // Revert to active category
    if (window.resetTurnstile) window.resetTurnstile();
};

export function setupAuthListeners() {
    if (authLoginBtn) authLoginBtn.addEventListener('click', () => openAuthModal('login'));
    if (userProfileBadge) userProfileBadge.addEventListener('click', () => openAuthModal());
    if (closeAuthModalBtn) closeAuthModalBtn.addEventListener('click', closeAuthModal);

    if (showRegisterBtn) showRegisterBtn.addEventListener('click', (e) => { e.preventDefault(); openAuthModal('register'); });
    if (showLoginBtn) showLoginBtn.addEventListener('click', (e) => { e.preventDefault(); openAuthModal('login'); });

    // Forgot Password navigation
    if (showForgotPasswordBtn) showForgotPasswordBtn.addEventListener('click', (e) => { e.preventDefault(); openAuthModal('forgot'); });
    if (showLoginFromForgotBtn) showLoginFromForgotBtn.addEventListener('click', (e) => { e.preventDefault(); openAuthModal('login'); });

    // === Password Visibility Toggle Handler ===
    document.querySelectorAll('.toggle-password').forEach(btn => {
        btn.addEventListener('click', () => {
            const input = btn.previousElementSibling;
            if (input && (input.type === 'password' || input.type === 'text')) {
                if (input.type === 'password') {
                    input.type = 'text';
                    btn.textContent = 'visibility_off';
                } else {
                    input.type = 'password';
                    btn.textContent = 'visibility';
                }
            }
        });
    });

    // === Setup Register Email + OTP Flow ===
    if (registerEmailInput && registerGetOtpBtn) {
        setupOtpFlow('register', {
            emailInput: registerEmailInput,
            emailHint: registerEmailHint,
            getOtpBtn: registerGetOtpBtn,
            getOtpWrapper: registerGetOtpWrapper,
            emailGroup: registerEmailGroup,
            otpSection: registerOtpSection,
            otpInput: registerOtpInput,
            otpHint: registerOtpHint,
            resendBtn: registerResendOtpBtn,
            timerEl: registerOtpTimer,
            onVerified: (email) => {
                // Style email as verified
                registerEmailInput.readOnly = true;
                registerEmailInput.style.background = 'rgba(40, 167, 69, 0.05)';
                registerEmailInput.style.color = '#28a745';
                registerEmailInput.style.borderStyle = 'solid';
                registerEmailInput.style.borderColor = '#28a745';
                registerEmailHint.textContent = '✓ Email verified! Please complete the rest of the form.';
                registerEmailHint.style.color = '#28a745';

                // Reveal hidden fields with animation
                if (registerHiddenFields) {
                    registerHiddenFields.style.display = 'block';
                    registerHiddenFields.style.animation = 'otpReveal 0.4s ease-out';
                    // Trigger username-based ID generation if username already filled
                    if (registerUsernameInput && registerUsernameInput.value.trim()) {
                        registerUsernameInput.dispatchEvent(new Event('input'));
                    }
                }
            }
        });

        // Real-time unique email check for Register
        let registerEmailDebounce;
        registerEmailInput.addEventListener('input', () => {
            clearTimeout(registerEmailDebounce);
            const email = registerEmailInput.value.trim().toLowerCase();
            const isValidFormat = validateEmail(email, registerEmailHint);

            if (!isValidFormat) {
                registerGetOtpWrapper.style.display = 'none';
                return;
            }

            if (email === '') {
                registerGetOtpWrapper.style.display = 'none';
                registerEmailHint.textContent = 'Only Gmail addresses are accepted.';
                registerEmailHint.style.color = 'var(--text-muted)';
                return;
            }

            registerEmailHint.textContent = 'Checking availability...';
            registerEmailHint.style.color = 'var(--text-muted)';
            registerGetOtpWrapper.style.display = 'none';

            registerEmailDebounce = setTimeout(async () => {
                try {
                    const q = query(collection(db, 'Users'), where('email', '==', email));
                    const snap = await getDocs(q);
                    if (snap.empty) {
                        registerEmailHint.textContent = '✓ Email is available.';
                        registerEmailHint.style.color = '#28a745';
                        registerGetOtpWrapper.style.display = 'block';
                        registerGetOtpBtn.disabled = !window.isRegisterTurnstilePassed;
                    } else {
                        registerEmailHint.textContent = '✗ Account already exists with this email. Please login instead.';
                        registerEmailHint.style.color = '#ff4444';
                        registerGetOtpWrapper.style.display = 'none';
                        registerGetOtpBtn.disabled = true;
                    }
                } catch (err) {
                    console.error('Email check error:', err);
                    registerEmailHint.textContent = '✗ Error checking email. Try again.';
                    registerEmailHint.style.color = '#ff4444';
                }
            }, 600);
        });

        // Real-time unique mobile check for Register
        let registerMobileDebounce;
        registerMobileInput.addEventListener('input', () => {
            clearTimeout(registerMobileDebounce);
            const mobile = registerMobileInput.value.trim();
            if (mobile.length < 10) {
                registerMobileHint.textContent = 'Enter a valid mobile number.';
                registerMobileHint.style.color = 'var(--text-muted)';
                return;
            }
            registerMobileHint.textContent = 'Checking availability...';
            registerMobileHint.style.color = 'var(--text-muted)';

            registerMobileDebounce = setTimeout(async () => {
                try {
                    const q = query(collection(db, 'Users'), where('mobile', '==', mobile));
                    const snap = await getDocs(q);
                    if (snap.empty) {
                        registerMobileHint.textContent = '✓ Mobile number is available.';
                        registerMobileHint.style.color = '#28a745';
                    } else {
                        registerMobileHint.textContent = '✗ This number is already registered. Please use another.';
                        registerMobileHint.style.color = '#ff4444';
                    }
                } catch (err) {
                    registerMobileHint.textContent = '✗ Error checking mobile. Try again.';
                    registerMobileHint.style.color = '#ff4444';
                }
            }, 600);
        });
    }

    // === Setup Forgot Password Email + OTP Flow ===
    if (forgotEmailInput && forgotGetOtpBtn) {
        // Real-time account check for Forgot Password
        let forgotEmailDebounce;
        forgotEmailInput.addEventListener('input', () => {
            clearTimeout(forgotEmailDebounce);
            const email = forgotEmailInput.value.trim().toLowerCase();
            const isValidFormat = validateEmail(email, forgotEmailHint);

            if (!isValidFormat) {
                forgotGetOtpWrapper.style.display = 'none';
                return;
            }

            if (email === '') {
                forgotGetOtpWrapper.style.display = 'none';
                forgotEmailHint.textContent = 'Enter your registered Gmail address.';
                forgotEmailHint.style.color = 'var(--text-muted)';
                return;
            }

            forgotEmailHint.textContent = 'Checking account...';
            forgotEmailHint.style.color = 'var(--text-muted)';
            forgotGetOtpWrapper.style.display = 'none';

            forgotEmailDebounce = setTimeout(async () => {
                try {
                    const q = query(collection(db, 'Users'), where('email', '==', email));
                    const snap = await getDocs(q);
                    if (!snap.empty) {
                        forgotEmailHint.textContent = '✓ Account found. You can request an OTP.';
                        forgotEmailHint.style.color = '#28a745';
                        forgotGetOtpWrapper.style.display = 'block';
                        forgotGetOtpBtn.disabled = false;
                    } else {
                        forgotEmailHint.textContent = '✗ No account found with this email address.';
                        forgotEmailHint.style.color = '#ff4444';
                        forgotGetOtpWrapper.style.display = 'none';
                        forgotGetOtpBtn.disabled = true;
                    }
                } catch (err) {
                    console.error('Account check error:', err);
                    forgotEmailHint.textContent = '✗ Error checking account. Try again.';
                    forgotEmailHint.style.color = '#ff4444';
                }
            }, 600);
        });

        forgotGetOtpBtn.addEventListener('click', async () => {
            const email = forgotEmailInput.value.trim().toLowerCase();
            // Final check — though button is only visible if found
            forgotGetOtpBtn.disabled = true;
            forgotGetOtpBtn.textContent = 'Sending OTP...';

            const otp = generateOTP();
            otpState.forgot.code = otp;
            otpState.forgot.expiry = Date.now() + 5 * 60 * 1000;
            otpState.forgot.email = email;

            const sent = await sendOtpEmail(email, otp);
            if (sent) {
                // Keep emailGroup visible, hide button, show OTP
                forgotGetOtpWrapper.style.display = 'none';
                forgotOtpSection.style.display = 'block';
                forgotOtpInput.value = '';
                forgotOtpInput.focus();
                forgotOtpHint.textContent = 'Check your Gmail inbox for the verification code.';
                forgotOtpHint.style.color = 'var(--text-muted)';
                startOtpTimer('forgot', forgotOtpTimer, forgotResendOtpBtn);
            } else {
                forgotEmailHint.textContent = '✗ Failed to send OTP. Please try again.';
                forgotEmailHint.style.color = '#ff4444';
                forgotGetOtpBtn.disabled = false;
                forgotGetOtpBtn.textContent = 'Get OTP';
            }
        });

        // Resend OTP for forgot
        forgotResendOtpBtn.addEventListener('click', async () => {
            const email = otpState.forgot.email;
            if (!email) return;
            forgotResendOtpBtn.disabled = true;
            forgotResendOtpBtn.textContent = 'Sending...';

            const otp = generateOTP();
            otpState.forgot.code = otp;
            otpState.forgot.expiry = Date.now() + 5 * 60 * 1000;

            const sent = await sendOtpEmail(email, otp);
            if (sent) {
                forgotOtpHint.textContent = '✓ New OTP sent! Check your inbox.';
                forgotOtpHint.style.color = '#28a745';
                forgotOtpInput.value = '';
                forgotOtpInput.focus();
                startOtpTimer('forgot', forgotOtpTimer, forgotResendOtpBtn);
            } else {
                forgotOtpHint.textContent = '✗ Failed to resend. Try again shortly.';
                forgotOtpHint.style.color = '#ff4444';
            }
            forgotResendOtpBtn.textContent = 'Resend OTP';
        });

        // Real-time OTP verification for forgot
        forgotOtpInput.addEventListener('input', () => {
            forgotOtpInput.value = forgotOtpInput.value.replace(/[^0-9]/g, '');
            if (forgotOtpInput.value.length === 6) {
                if (!otpState.forgot.code || Date.now() > otpState.forgot.expiry) {
                    forgotOtpHint.textContent = '✗ OTP has expired. Please request a new one.';
                    forgotOtpHint.style.color = '#ff4444';
                    return;
                }
                if (forgotOtpInput.value === otpState.forgot.code) {
                    forgotOtpHint.textContent = '✓ Email verified successfully!';
                    forgotOtpHint.style.color = '#28a745';
                    forgotOtpInput.disabled = true;
                    forgotOtpInput.style.borderColor = '#28a745';
                    forgotResendOtpBtn.disabled = true;
                    if (otpState.forgot.timer) clearInterval(otpState.forgot.timer);
                    forgotOtpTimer.textContent = '✓ Verified';
                    forgotOtpTimer.style.color = '#28a745';

                    // Show new password fields
                    setTimeout(() => {
                        forgotOtpSection.style.display = 'none';
                        forgotNewPasswordSection.style.display = 'block';
                        forgotNewPasswordSection.style.animation = 'otpReveal 0.4s ease-out';
                        if (forgotNewPasswordInput) forgotNewPasswordInput.focus();
                    }, 400);
                } else {
                    forgotOtpHint.textContent = '✗ Incorrect OTP. Please try again.';
                    forgotOtpHint.style.color = '#ff4444';
                }
            }
        });
    }

    // === Setup Profile Email + OTP Flow ===
    if (profileEmailInput && profileGetOtpBtn) {
        setupOtpFlow('profile', {
            emailInput: profileEmailInput,
            emailHint: profileEmailHint,
            getOtpBtn: profileGetOtpBtn,
            getOtpWrapper: profileGetOtpWrapper,
            emailGroup: profileEmailGroup,
            otpSection: profileOtpSection,
            otpInput: profileOtpInput,
            otpHint: profileOtpHint,
            resendBtn: profileResendOtpBtn,
            timerEl: profileOtpTimer,
            onVerified: (email) => {
                state.currentUser.email = email;
                if (localStorage.getItem('tc_user')) localStorage.setItem('tc_user', JSON.stringify(state.currentUser));
                if (sessionStorage.getItem('tc_user')) sessionStorage.setItem('tc_user', JSON.stringify(state.currentUser));
                
                profileEmailInput.readOnly = true;
                profileEmailInput.style.background = 'var(--bg-subtle)';
                profileEmailInput.style.color = 'var(--text-muted)';
                profileEmailInput.style.borderStyle = 'dashed';
                
                profileEmailHint.textContent = '✓ Email verified! Click Update Profile to save.';
                profileEmailHint.style.color = '#28a745';
                
                // Keep the change button hidden until next modal open
                if (profileChangeEmailBtn) profileChangeEmailBtn.style.display = 'none';

                // Check and show update button after verification
                checkProfileChanges();
            }
        });

        // Real-time unique email check for Profile Change
        let profileEmailDebounce;
        profileEmailInput.addEventListener('input', () => {
            if (profileEmailInput.readOnly) return; 
            
            clearTimeout(profileEmailDebounce);
            const email = profileEmailInput.value.trim().toLowerCase();
            const isValidFormat = validateEmail(email, profileEmailHint);

            profileGetOtpWrapper.style.display = 'none';

            if (!isValidFormat) {
                return;
            }

            if (email === state.currentUser?.email?.toLowerCase()) {
                profileEmailHint.textContent = 'This is your current email.';
                profileEmailHint.style.color = 'var(--text-muted)';
                return;
            }

            profileEmailHint.textContent = 'Checking availability...';
            profileEmailHint.style.color = 'var(--text-muted)';

            profileEmailDebounce = setTimeout(async () => {
                try {
                    const q = query(collection(db, 'Users'), where('email', '==', email));
                    const snap = await getDocs(q);
                    
                    if (snap.empty) {
                        profileEmailHint.textContent = '✓ Email is available.';
                        profileEmailHint.style.color = '#28a745';
                        profileGetOtpWrapper.style.display = 'block';
                    } else {
                        profileEmailHint.textContent = '✗ This email is already taken. Please use a different one.';
                        profileEmailHint.style.color = '#ff4444';
                        profileGetOtpWrapper.style.display = 'none';
                    }
                } catch (err) {
                    console.error('Profile email check error:', err);
                    profileEmailHint.textContent = '✗ Error checking email. Try again.';
                    profileEmailHint.style.color = '#ff4444';
                }
            }, 600);
        });

        // Real-time unique mobile check for Profile
        let profileMobileDebounce;
        profileMobileInput.addEventListener('input', () => {
            clearTimeout(profileMobileDebounce);
            const mobile = profileMobileInput.value.trim();
            const originalMobile = (state.currentUser?.mobile || '');

            if (mobile === originalMobile) {
                profileMobileHint.textContent = '';
                checkProfileChanges();
                return;
            }

            if (mobile.length < 10) {
                profileMobileHint.textContent = 'Enter a valid mobile number.';
                profileMobileHint.style.color = 'var(--text-muted)';
                checkProfileChanges();
                return;
            }

            profileMobileHint.textContent = 'Checking availability...';
            profileMobileHint.style.color = 'var(--text-muted)';

            profileMobileDebounce = setTimeout(async () => {
                try {
                    const q = query(collection(db, 'Users'), where('mobile', '==', mobile));
                    const snap = await getDocs(q);
                    if (snap.empty) {
                        profileMobileHint.textContent = '✓ Mobile number available.';
                        profileMobileHint.style.color = '#28a745';
                    } else {
                        profileMobileHint.textContent = '✗ Already taken by another account.';
                        profileMobileHint.style.color = '#ff4444';
                    }
                    checkProfileChanges(); 
                } catch (err) {
                    profileMobileHint.textContent = '✗ Error checking availability.';
                    profileMobileHint.style.color = '#ff4444';
                    checkProfileChanges();
                }
            }, 600);
        });
    }

    if (profileChangeEmailBtn) {
        profileChangeEmailBtn.addEventListener('click', () => {
            profileEmailInput.readOnly = false;
            profileEmailInput.style.background = 'var(--bg-card)';
            profileEmailInput.style.color = 'var(--text-main)';
            profileEmailInput.style.borderStyle = 'solid';
            profileEmailInput.style.borderColor = 'var(--primary)';
            profileEmailInput.focus();

            profileChangeEmailBtn.style.display = 'none';
            profileGetOtpWrapper.style.display = 'none'; // Initially hide until valid new email
            profileEmailHint.textContent = 'Enter your new Gmail address.';
            profileEmailHint.style.color = 'var(--text-muted)';
        });
    }

    // === Forgot Password Submit (Reset Password) ===
    if (forgotSubmitBtn) {
        forgotSubmitBtn.addEventListener('click', async () => {
            const newPass = forgotNewPasswordInput?.value;
            const confirmPass = forgotConfirmPasswordInput?.value;

            if (!newPass || !confirmPass) {
                alert('Please fill in both password fields.');
                return;
            }
            if (newPass !== confirmPass) {
                alert('Passwords do not match.');
                return;
            }
            if (newPass.length < 4) {
                alert('Password must be at least 4 characters long.');
                return;
            }

            const email = otpState.forgot.email;
            if (!email) {
                alert('Session expired. Please start over.');
                openAuthModal('forgot');
                return;
            }

            forgotSubmitBtn.disabled = true;
            forgotSubmitBtn.textContent = 'Resetting...';

            try {
                const q = query(collection(db, 'Users'), where('email', '==', email));
                const snap = await getDocs(q);
                if (snap.empty) {
                    alert('No account found. Please register instead.');
                    openAuthModal('register');
                    return;
                }

                const userDoc = snap.docs[0];
                await updateDoc(doc(db, 'Users', userDoc.id), { password: newPass });

                alert('Password reset successfully! Please log in with your new password.');
                openAuthModal('login');
            } catch (err) {
                console.error('Password Reset Error:', err);
                alert('Failed to reset password. Please try again.');
            }

            forgotSubmitBtn.disabled = false;
            forgotSubmitBtn.textContent = 'Reset Password';
        });
    }

    if (authLogoutBtn) {
        authLogoutBtn.addEventListener('click', () => {
            state.currentUser = null;
            localStorage.removeItem('tc_user');
            sessionStorage.removeItem('tc_user');

            // Wipe local cart on explicit sign out
            updateCart([]);

            updateAuthUI();
            closeAuthModal();
            refreshTrackingBadge();

            // Bounce to root category visually
            if (state.categories.length > 0) {
                state.currentCategorySlug = state.categories[0].slug;
                if (window.updateUrlState) window.updateUrlState(state.currentCategorySlug);
                if (window.renderCategoryTabs) window.renderCategoryTabs();
                if (window.renderProducts) window.renderProducts(state.currentCategorySlug, 1);
            }
        });
    }

    // UserID Auto-generation logic (Debounced) — triggered by username input
    let debounceTimer;
    if (registerUsernameInput) {
        registerUsernameInput.addEventListener('input', () => {
            clearTimeout(debounceTimer);
            const username = registerUsernameInput.value.trim();
            const baseId = generateSlug(username);
            const hint = document.getElementById('register-userid-hint');

            if (!baseId) {
                registerUseridInput.value = '';
                registerSubmitBtn.disabled = false;
                if (hint) { hint.textContent = 'Leave matching your username for best results.'; hint.style.color = 'var(--text-muted)'; }
                return;
            }

            if (baseId.includes('admin') || username.toLowerCase().includes('admin')) {
                registerUseridInput.value = "Username cannot contain 'admin'";
                registerSubmitBtn.disabled = true;
                if (hint) { hint.textContent = 'Admin keyword is not allowed.'; hint.style.color = '#ff4444'; }
                return;
            }

            registerUseridInput.value = "Checking availability...";
            registerSubmitBtn.disabled = true;
            if (hint) { hint.textContent = 'Checking...'; hint.style.color = 'var(--text-muted)'; }

            debounceTimer = setTimeout(async () => {
                try {
                    let candidate = baseId;
                    let i = 0;
                    while (true) {
                        const docSnap = await getDoc(doc(db, 'Users', candidate));
                        if (!docSnap.exists()) {
                            registerUseridInput.value = candidate;
                            registerSubmitBtn.disabled = false;
                            if (hint) { hint.textContent = '✓ ID is available.'; hint.style.color = '#28a745'; }
                            break;
                        }
                        i++;
                        candidate = baseId + i;
                    }
                } catch (e) {
                    console.error("Error auto-generating ID:", e);
                    registerUseridInput.value = "Error checking ID";
                    registerSubmitBtn.disabled = false;
                    if (hint) { hint.textContent = 'Error checking availability.'; hint.style.color = '#ff4444'; }
                }
            }, 600);
        });
    }

    // Real-time validation when user manually edits the register userid
    let regIdDebounce;
    if (registerUseridInput) {
        registerUseridInput.addEventListener('input', () => {
            clearTimeout(regIdDebounce);
            const hint = document.getElementById('register-userid-hint');
            const rawId = registerUseridInput.value.trim();
            const candidateId = generateSlug(rawId);

            if (!candidateId) {
                registerSubmitBtn.disabled = true;
                if (hint) { hint.textContent = 'Please enter a valid ID.'; hint.style.color = '#ff4444'; }
                return;
            }

            if (candidateId.includes('admin')) {
                registerSubmitBtn.disabled = true;
                if (hint) { hint.textContent = 'ID cannot contain "admin".'; hint.style.color = '#ff4444'; }
                return;
            }

            registerSubmitBtn.disabled = true;
            if (hint) { hint.textContent = 'Checking availability...'; hint.style.color = 'var(--text-muted)'; }

            regIdDebounce = setTimeout(async () => {
                try {
                    const docSnap = await getDoc(doc(db, 'Users', candidateId));
                    if (!docSnap.exists()) {
                        registerUseridInput.value = candidateId;
                        registerSubmitBtn.disabled = false;
                        if (hint) { hint.textContent = '✓ ID is available.'; hint.style.color = '#28a745'; }
                    } else {
                        registerSubmitBtn.disabled = true;
                        if (hint) { hint.textContent = '✗ ID is already taken. Try another.'; hint.style.color = '#ff4444'; }
                    }
                } catch (e) {
                    registerSubmitBtn.disabled = false;
                    if (hint) { hint.textContent = 'Error checking availability.'; hint.style.color = '#ff4444'; }
                }
            }, 500);
        });
    }

    // Real-time validation for profile userid changes
    let profileIdDebounce;
    if (profileUseridInput) {
        profileUseridInput.addEventListener('input', () => {
            clearTimeout(profileIdDebounce);
            const hint = document.getElementById('profile-userid-hint');
            const rawId = profileUseridInput.value.trim();
            const candidateId = generateSlug(rawId);

            if (!candidateId) {
                if (profileUpdateBtn) profileUpdateBtn.disabled = true;
                if (hint) { hint.textContent = 'Please enter a valid ID.'; hint.style.color = '#ff4444'; }
                return;
            }

            if (candidateId.includes('admin')) {
                if (profileUpdateBtn) profileUpdateBtn.disabled = true;
                if (hint) { hint.textContent = 'ID cannot contain "admin".'; hint.style.color = '#ff4444'; }
                return;
            }

            // If same as current, no check needed
            if (candidateId === state.currentUser?.id) {
                if (profileUpdateBtn) profileUpdateBtn.disabled = false;
                if (hint) { hint.textContent = 'This is your current ID.'; hint.style.color = 'var(--text-muted)'; }
                return;
            }

            if (profileUpdateBtn) profileUpdateBtn.disabled = true;
            if (hint) { hint.textContent = 'Checking availability...'; hint.style.color = 'var(--text-muted)'; }

            profileIdDebounce = setTimeout(async () => {
                try {
                    const docSnap = await getDoc(doc(db, 'Users', candidateId));
                    if (!docSnap.exists()) {
                        profileUseridInput.value = candidateId;
                        if (profileUpdateBtn) profileUpdateBtn.disabled = false;
                        if (hint) { hint.textContent = '✓ ID is available.'; hint.style.color = '#28a745'; }
                    } else {
                        if (profileUpdateBtn) profileUpdateBtn.disabled = true;
                        if (hint) { hint.textContent = '✗ ID is already taken. Try another.'; hint.style.color = '#ff4444'; }
                    }
                } catch (e) {
                    if (profileUpdateBtn) profileUpdateBtn.disabled = false;
                    if (hint) { hint.textContent = 'Error checking availability.'; hint.style.color = '#ff4444'; }
                }
            }, 500);
        });
    }

    // Login Submit
    if (loginForm) {
        loginForm.addEventListener('submit', async (e) => {
            e.preventDefault();
            const identifier = loginIdentifierInput.value.trim();
            const password = loginPasswordInput.value;
            const remember = loginRememberInput.checked;

            if (!identifier || !password) return;

            loginSubmitBtn.disabled = true;
            loginSubmitBtn.textContent = "Checking...";
            try {
                let userSnap = null;
                
                // 1. Try Mobile Number
                const qMobile = query(collection(db, 'Users'), where('mobile', '==', identifier));
                const qsMobile = await getDocs(qMobile);
                if (!qsMobile.empty) {
                    userSnap = qsMobile.docs[0];
                }

                // 2. Try Email Address
                if (!userSnap) {
                    const qEmail = query(collection(db, 'Users'), where('email', '==', identifier.toLowerCase()));
                    const qsEmail = await getDocs(qEmail);
                    if (!qsEmail.empty) {
                        userSnap = qsEmail.docs[0];
                    }
                }

                if (userSnap && userSnap.exists()) {
                    const data = userSnap.data();
                    if (data.password === password) {
                        state.currentUser = {
                            id: userSnap.id,
                            name: data.username || '',
                            email: data.email || '',
                            mobile: data.mobile || '',
                            address: data.address || '',
                            district: data.district || '',
                            thana: data.thana || ''
                        };

                        if (remember) {
                            localStorage.setItem('tc_user', JSON.stringify(state.currentUser));
                        } else {
                            sessionStorage.setItem('tc_user', JSON.stringify(state.currentUser));
                        }

                        if (window.handleFirebaseCartSync) await window.handleFirebaseCartSync(state.currentUser.id);

                        updateAuthUI();
                        closeAuthModal();
                        refreshTrackingBadge();

                        if (state.currentCategorySlug && window.updateUrlState) {
                            window.updateUrlState(state.currentCategorySlug);
                        }
                    } else {
                        alert("Incorrect password.");
                    }
                } else {
                    alert("Account not found. Please register.");
                }
            } catch (err) {
                console.error("Login Error:", err);
                alert("Error communicating with the database.");
            }

            loginSubmitBtn.disabled = false;
            loginSubmitBtn.textContent = "Login";
        });
    }

    // Register Submit
    if (registerForm) {
        registerForm.addEventListener('submit', async (e) => {
            e.preventDefault();
            const username = registerUsernameInput.value.trim();
            const userid = registerUseridInput.value.trim();
            const email = registerEmailInput?.value.trim().toLowerCase() || '';
            const mobile = registerMobileInput.value.trim();
            const password = registerPasswordInput.value;
            const address = registerAddressInput.value.trim();
            const rawDistrict = registerDistrictInput.value;
            const rawThana = registerThanaInput.value;
            const remember = registerRememberInput.checked;

            if (!username || !userid || !password || !mobile || !rawDistrict || !rawThana || userid.includes("Checking") || userid.includes("contains") || userid.includes("Error")) {
                alert("Please fill all fields properly (including District and Thana) and wait for ID validation.");
                return;
            }

            // Check if register button was disabled due to taken ID or mobile
            const regHint = document.getElementById('register-userid-hint');
            if (regHint && regHint.style.color === 'rgb(255, 68, 68)') {
                alert("The User ID '" + userid + "' is not available. Please choose a different one.");
                return;
            }

            const mobHint = document.getElementById('register-mobile-hint');
            if (mobHint && mobHint.style.color === 'rgb(255, 68, 68)') {
                alert("This mobile number is already in use. Please use a different one.");
                return;
            }

            if (username.toLowerCase().includes('admin') || userid.toLowerCase().includes('admin')) {
                alert("Security Policy: Usernames and IDs cannot contain the word 'admin'.");
                registerSubmitBtn.disabled = false;
                return;
            }

            registerSubmitBtn.disabled = true;
            registerSubmitBtn.textContent = "Registering...";

            try {
                const userRef = doc(db, 'Users', userid);
                const userSnap = await getDoc(userRef);

                if (userSnap.exists()) {
                    alert("Conflict: The requested User ID '" + userid + "' is already heavily tracked! Please alter it manually.");
                } else {
                    let finalDistrict = rawDistrict;
                    if (window.getTrueDistrict) finalDistrict = window.getTrueDistrict(rawDistrict, rawThana);

                    await setDoc(userRef, {
                        username: username,
                        email: email,
                        mobile: mobile,
                        password: password,
                        address: address,
                        district: finalDistrict,
                        thana: rawThana,
                        createdAt: Date.now()
                    });

                    state.currentUser = { id: userid, name: username, email: email, mobile: mobile, address: address, district: finalDistrict, thana: rawThana };
                    if (remember) {
                        localStorage.setItem('tc_user', JSON.stringify(state.currentUser));
                    } else {
                        sessionStorage.setItem('tc_user', JSON.stringify(state.currentUser));
                    }

                    updateCart([]);

                    updateAuthUI();
                    closeAuthModal();
                    refreshTrackingBadge();

                    if (state.currentCategorySlug && window.updateUrlState) {
                        window.updateUrlState(state.currentCategorySlug);
                    }
                }
            } catch (err) {
                console.error("Register Error:", err);
                alert("Error communicating with the database.");
            }

            registerSubmitBtn.disabled = false;
            registerSubmitBtn.textContent = "Register";
        });
    }

    // Profile Update Submit
    if (profileForm) {
        profileForm.addEventListener('submit', async (e) => {
            e.preventDefault();
            const newUsername = profileUsernameInput.value.trim();
            const newUserid = generateSlug(profileUseridInput.value.trim());
            const newAddress = profileAddressInput.value.trim();
            const newMobile = profileMobileInput.value.trim();
            const rawDistrict = profileDistrictInput.value;
            const rawThana = profileThanaInput.value;
            const newEmail = profileEmailInput.value.trim().toLowerCase();

            // Email Change Verification Check
            if (newEmail !== (state.currentUser.email || '').toLowerCase()) {
                if (otpState.profile.email !== newEmail) {
                    alert("Please verify your new email address via OTP before saving.");
                    return;
                }
            }

            if (!state.currentUser) return;
            if (!newUsername) {
                alert("Username cannot be empty.");
                return;
            }
            if (!newUserid) {
                alert("User ID cannot be empty.");
                return;
            }
            if (newUserid.includes('admin')) {
                alert("User ID cannot contain 'admin'.");
                return;
            }
            // Check if profile userid hint shows an error (taken/invalid)
            const profHint = document.getElementById('profile-userid-hint');
            if (profHint && profHint.style.color === 'rgb(255, 68, 68)') {
                alert("The User ID '" + newUserid + "' is not available. Please choose a different one.");
                return;
            }
            if (!rawDistrict || !rawThana) {
                alert("Please accurately select both a District and a Thana before saving.");
                return;
            }

            profileUpdateBtn.disabled = true;
            profileUpdateBtn.textContent = "Updating...";

            try {
                let finalDistrict = rawDistrict;
                if (window.getTrueDistrict) finalDistrict = window.getTrueDistrict(rawDistrict, rawThana);

                const oldId = state.currentUser.id;
                const idChanged = newUserid !== oldId;

                if (idChanged) {
                    // Check collision one final time
                    const checkSnap = await getDoc(doc(db, 'Users', newUserid));
                    if (checkSnap.exists()) {
                        alert("This User ID is already taken. Please choose another.");
                        profileUpdateBtn.disabled = false;
                        profileUpdateBtn.textContent = "Update Profile";
                        return;
                    }

                    // Read old user data
                    const oldSnap = await getDoc(doc(db, 'Users', oldId));
                    const oldData = oldSnap.exists() ? oldSnap.data() : {};

                    // Merge new data
                    const newData = {
                        ...oldData,
                        username: newUsername,
                        address: newAddress,
                        mobile: newMobile,
                        district: finalDistrict,
                        thana: rawThana,
                        email: profileEmailInput.value.trim()
                    };

                    // Create new doc
                    await setDoc(doc(db, 'Users', newUserid), newData);

                    // Migrate Cart subcollection
                    try {
                        const cartSnap = await getDocs(collection(db, 'Users', oldId, 'Cart'));
                        if (!cartSnap.empty) {
                            const batch = writeBatch(db);
                            cartSnap.docs.forEach(d => {
                                batch.set(doc(db, 'Users', newUserid, 'Cart', d.id), d.data());
                                batch.delete(doc(db, 'Users', oldId, 'Cart', d.id));
                            });
                            await batch.commit();
                        }
                    } catch (migErr) { console.warn('Cart migration partial:', migErr); }

                    // Delete old doc
                    await deleteDoc(doc(db, 'Users', oldId));

                    state.currentUser.id = newUserid;
                } else {
                    // Just update existing doc
                    await updateDoc(doc(db, 'Users', oldId), {
                        username: newUsername,
                        address: newAddress,
                        mobile: newMobile,
                        district: finalDistrict,
                        thana: rawThana,
                        email: profileEmailInput.value.trim()
                    });
                }

                state.currentUser.email = profileEmailInput.value.trim();
                state.currentUser.name = newUsername;
                state.currentUser.address = newAddress;
                state.currentUser.mobile = newMobile;
                state.currentUser.district = finalDistrict;
                state.currentUser.thana = rawThana;

                if (localStorage.getItem('tc_user')) {
                    localStorage.setItem('tc_user', JSON.stringify(state.currentUser));
                } else {
                    sessionStorage.setItem('tc_user', JSON.stringify(state.currentUser));
                }

                updateAuthUI();
                alert("Profile updated successfully!" + (idChanged ? " Your new ID is: " + newUserid : ""));
                closeAuthModal();

                // Update URL to reflect new user ID
                if (idChanged && state.currentCategorySlug && window.updateUrlState) {
                    window.updateUrlState(state.currentCategorySlug);
                }
            } catch (err) {
                console.error("Profile Update Error:", err);
                alert("Failed to update profile.");
            }

            profileUpdateBtn.disabled = false;
            profileUpdateBtn.textContent = "Update Profile";
        });
    }
}

// --- Profile Order Loader ---
export async function loadProfileOrders() {
    if (!profileOrdersList || !state.currentUser) return;
    profileOrdersList.innerHTML = '<div style="color: var(--text-muted); font-size: 0.9rem;">Loading orders...</div>';

    try {
        const q = query(collection(db, 'Orders'), where('userId', '==', state.currentUser.id));
        const snapshots = await getDocs(q);

        profileOrdersList.innerHTML = '';
        if (snapshots.empty) {
            profileOrdersList.innerHTML = '<div style="color: var(--text-muted); font-size: 0.9rem;">No past orders found.</div>';
            return;
        }

        const orders = snapshots.docs.map(d => ({ id: d.id, ...d.data() })).sort((a, b) => b.createdAt - a.createdAt);

        orders.forEach(order => {
            const dateStr = new Date(order.createdAt).toLocaleDateString();
            const el = document.createElement('div');
            el.style.cssText = "background: var(--bg-main); border: 1px solid var(--border-color); border-radius: var(--radius-sm); padding: 1.25rem; display: flex; flex-direction: column; gap: 0.75rem;";

            let itemsHtml = (order.items || []).map(i => `<li style="margin-bottom: 4px;">${i.qty}x <strong>${i.name}</strong> (৳${(i.price || 0).toFixed(2)})</li>`).join('');

            const statusClass = (order.status || 'Pending').toLowerCase();
            const badgeClass = order.status === 'Delivered' ? 'status-delivered' : (order.status === 'Sent' ? 'status-sent' : 'status-pending');

            el.innerHTML = `
                <div style="display: flex; justify-content: space-between; align-items: center; border-bottom: 1px dashed var(--border-color); padding-bottom: 0.75rem; margin-bottom: 0.25rem;">
                    <div style="font-weight: 700; color: var(--text-main);">Order #${order.id.slice(0, 8)}</div>
                    <span class="status-badge ${badgeClass}">${order.status || 'Pending'}</span>
                </div>
                
                <div style="font-size: 0.85rem; color: var(--text-muted); display: flex; align-items: center; gap: 5px;">
                    <span class="material-icons-round" style="font-size: 16px;">calendar_today</span>
                    Ordered on ${dateStr}
                </div>

                <ul style="margin: 0; padding-left: 1.25rem; font-size: 0.9rem; color: var(--text-main); line-height: 1.4;">
                    ${itemsHtml}
                </ul>

                <div style="display: flex; justify-content: space-between; align-items: center; margin-top: 0.5rem; border-top: 1px solid var(--border-color); padding-top: 0.75rem;">
                    <a href="${state.currentUser.id}/Orders/${order.id}" class="btn btn-secondary btn-sm" style="padding: 0.4rem 0.8rem; font-size: 0.85rem; border-radius: 6px;">
                        <span class="material-icons-round" style="font-size: 18px;">receipt_long</span> View Invoice
                    </a>
                    <div style="font-weight: 800; font-size: 1.1rem; color: var(--primary);">
                        ৳${(order.totalPrice || 0).toFixed(2)}
                    </div>
                </div>
            `;
            profileOrdersList.appendChild(el);
        });

    } catch (err) {
        console.error("Failed to load orders:", err);
        profileOrdersList.innerHTML = '<div style="color: #ff4444; font-size: 0.9rem;">Failed to fetch history.</div>';
    }
}
window.loadProfileOrders = loadProfileOrders;
