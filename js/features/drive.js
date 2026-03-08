/**
 * drive.js — Google Drive image upload integration
 * Uses OAuth 2.0 refresh token flow so admin only logs in once.
 * Credentials are embedded (accepted risk for single-admin personal site).
 */

const DRIVE_CLIENT_ID = '4917744867-7e7gcckp9ikfmmagd5f6mh8d7pa36iqb.apps.googleusercontent.com';
const DRIVE_CLIENT_SECRET = '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';
const DRIVE_REDIRECT_URI = 'https://toyandcraft.shop';
const DRIVE_SCOPE = 'https://www.googleapis.com/auth/drive.file';

const LS_REFRESH_TOKEN = 'tc_drive_refresh_token';
const LS_ACCESS_TOKEN = 'tc_drive_access_token';
const LS_ACCESS_EXPIRY = 'tc_drive_access_expiry';

// ── Root folder IDs cache (avoids repeated lookups) ──────────────────────────
let rootFolderId = null;  // "Toy&Craft"
let productsFolderId = null; // "Toy&Craft/Products"
const categoryFolderIds = {}; // { slug: folderId }

// ── Token helpers ─────────────────────────────────────────────────────────────

/** Returns a valid access token, refreshing automatically if expired. */
export async function getDriveAccessToken() {
    const expiry = parseInt(localStorage.getItem(LS_ACCESS_EXPIRY) || '0');
    const now = Date.now();

    // Still valid (with 60-second buffer)
    if (localStorage.getItem(LS_ACCESS_TOKEN) && now < expiry - 60_000) {
        return localStorage.getItem(LS_ACCESS_TOKEN);
    }

    const refreshToken = localStorage.getItem(LS_REFRESH_TOKEN);

    if (refreshToken) {
        // Silently exchange refresh token → access token
        return await refreshAccessToken(refreshToken);
    }

    // First time: need user to authorize
    return await authorizeFirstTime();
}

/** Exchange a refresh token for a new access token. */
async function refreshAccessToken(refreshToken) {
    const res = await fetch('https://oauth2.googleapis.com/token', {
        method: 'POST',
        headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
        body: new URLSearchParams({
            client_id: DRIVE_CLIENT_ID,
            client_secret: DRIVE_CLIENT_SECRET,
            refresh_token: refreshToken,
            grant_type: 'refresh_token',
        }),
    });

    const data = await res.json();
    if (data.error) throw new Error('Drive token refresh failed: ' + data.error_description);

    const expiresAt = Date.now() + (data.expires_in * 1000);
    localStorage.setItem(LS_ACCESS_TOKEN, data.access_token);
    localStorage.setItem(LS_ACCESS_EXPIRY, String(expiresAt));
    return data.access_token;
}

/**
 * First-time OAuth: opens Google auth URL, waits for redirect with code,
 * exchanges code for refresh + access tokens.
 * If popup is blocked, falls back to redirect flow.
 */
async function authorizeFirstTime() {
    return new Promise((resolve, reject) => {
        const authUrl = `https://accounts.google.com/o/oauth2/v2/auth?` +
            new URLSearchParams({
                client_id: DRIVE_CLIENT_ID,
                redirect_uri: DRIVE_REDIRECT_URI,
                response_type: 'code',
                scope: DRIVE_SCOPE,
                access_type: 'offline',
                prompt: 'consent',
                state: 'drive_auth',
            });

        // Try popup first
        const popup = window.open(authUrl, 'drive_auth', 'width=500,height=600');
        if (!popup) {
            // Popup blocked — do a full page redirect
            localStorage.setItem('tc_drive_pending_auth', '1');
            window.location.href = authUrl;
            return;
        }

        // Poll for the popup redirect (it will come back to our site with ?code=)
        const poll = setInterval(async () => {
            try {
                if (popup.closed) {
                    clearInterval(poll);
                    reject(new Error('Google auth popup was closed.'));
                    return;
                }
                const url = new URL(popup.location.href);
                if (url.origin === window.location.origin) {
                    const code = url.searchParams.get('code');
                    if (code) {
                        popup.close();
                        clearInterval(poll);
                        const token = await exchangeCodeForTokens(code);
                        resolve(token);
                    }
                }
            } catch {
                // Cross-origin errors while popup is on Google — ignore
            }
        }, 500);
    });
}

/** Exchange authorization code → refresh + access tokens. */
async function exchangeCodeForTokens(code) {
    const res = await fetch('https://oauth2.googleapis.com/token', {
        method: 'POST',
        headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
        body: new URLSearchParams({
            client_id: DRIVE_CLIENT_ID,
            client_secret: DRIVE_CLIENT_SECRET,
            code,
            redirect_uri: DRIVE_REDIRECT_URI,
            grant_type: 'authorization_code',
        }),
    });

    const data = await res.json();
    if (data.error) throw new Error('Drive auth failed: ' + data.error_description);

    const expiresAt = Date.now() + (data.expires_in * 1000);
    localStorage.setItem(LS_REFRESH_TOKEN, data.refresh_token);
    localStorage.setItem(LS_ACCESS_TOKEN, data.access_token);
    localStorage.setItem(LS_ACCESS_EXPIRY, String(expiresAt));
    return data.access_token;
}

/** Check URL on page load for Drive auth redirect (handles code on return). */
export async function handleDriveAuthRedirect() {
    const urlParams = new URLSearchParams(window.location.search);
    if (urlParams.get('state') === 'drive_auth' && urlParams.get('code')) {
        const code = urlParams.get('code');
        try {
            await exchangeCodeForTokens(code);
            // Clean URL
            window.history.replaceState({}, '', window.location.pathname);
        } catch (e) {
            console.error('Drive auth redirect error:', e);
        }
    }
    localStorage.removeItem('tc_drive_pending_auth');
}

// ── Drive folder helpers ──────────────────────────────────────────────────────

/** Find a folder by name under a parent, or create it if missing. */
async function ensureFolder(name, parentId, accessToken) {
    // Search for existing folder
    const q = `name='${name}' and mimeType='application/vnd.google-apps.folder' and '${parentId}' in parents and trashed=false`;
    const searchRes = await fetch(
        `https://www.googleapis.com/drive/v3/files?q=${encodeURIComponent(q)}&fields=files(id,name)`,
        { headers: { Authorization: `Bearer ${accessToken}` } }
    );
    const searchData = await searchRes.json();

    if (searchData.files && searchData.files.length > 0) {
        return searchData.files[0].id;
    }

    // Create the folder
    const createRes = await fetch('https://www.googleapis.com/drive/v3/files', {
        method: 'POST',
        headers: {
            Authorization: `Bearer ${accessToken}`,
            'Content-Type': 'application/json',
        },
        body: JSON.stringify({
            name,
            mimeType: 'application/vnd.google-apps.folder',
            parents: [parentId],
        }),
    });
    const folder = await createRes.json();
    return folder.id;
}

/** Ensure full folder path: root → Toy&Craft → Products → category */
async function ensureCategoryFolder(categorySlug, accessToken) {
    if (categoryFolderIds[categorySlug]) return categoryFolderIds[categorySlug];

    // Toy&Craft root folder
    if (!rootFolderId) {
        const q = `name='Toy&Craft' and mimeType='application/vnd.google-apps.folder' and 'root' in parents and trashed=false`;
        const res = await fetch(
            `https://www.googleapis.com/drive/v3/files?q=${encodeURIComponent(q)}&fields=files(id)`,
            { headers: { Authorization: `Bearer ${accessToken}` } }
        );
        const data = await res.json();
        if (data.files && data.files.length > 0) {
            rootFolderId = data.files[0].id;
        } else {
            rootFolderId = await ensureFolder('Toy&Craft', 'root', accessToken);
        }
    }

    // Products sub-folder
    if (!productsFolderId) {
        productsFolderId = await ensureFolder('Products', rootFolderId, accessToken);
    }

    // Category sub-folder
    const catFolderId = await ensureFolder(categorySlug, productsFolderId, accessToken);
    categoryFolderIds[categorySlug] = catFolderId;
    return catFolderId;
}

// ── Main upload function ──────────────────────────────────────────────────────

/**
 * Upload an image file to Google Drive under Toy&Craft/Products/<categorySlug>/
 * Returns a public thumbnail URL.
 */
export async function uploadImageToDrive(file, categorySlug, customFileName = null) {
    const accessToken = await getDriveAccessToken();
    const folderId = await ensureCategoryFolder(categorySlug, accessToken);

    // Use custom name or generate a unique filename with timestamp
    const ext = file.name.split('.').pop();
    const safeName = customFileName ? customFileName : `${categorySlug}_${Date.now()}.${ext}`;

    // Multipart upload: metadata + file body
    const metadata = {
        name: safeName,
        parents: [folderId],
    };

    const form = new FormData();
    form.append('metadata', new Blob([JSON.stringify(metadata)], { type: 'application/json' }));
    form.append('file', file);

    const uploadRes = await fetch(
        'https://www.googleapis.com/upload/drive/v3/files?uploadType=multipart&fields=id,name',
        {
            method: 'POST',
            headers: { Authorization: `Bearer ${accessToken}` },
            body: form,
        }
    );

    const fileData = await uploadRes.json();
    if (!fileData.id) throw new Error('Drive upload failed: ' + JSON.stringify(fileData));

    // Make file public (anyone with link can view)
    await fetch(`https://www.googleapis.com/drive/v3/files/${fileData.id}/permissions`, {
        method: 'POST',
        headers: {
            Authorization: `Bearer ${accessToken}`,
            'Content-Type': 'application/json',
        },
        body: JSON.stringify({ role: 'reader', type: 'anyone' }),
    });

    // Return a fast-loading thumbnail URL (600px wide)
    return `https://drive.google.com/thumbnail?id=${fileData.id}&sz=w800`;
}

/** Rename an existing file in Drive. Extracts ID from thumbnail URL. */
export async function renameDriveFile(driveUrl, newName) {
    const match = driveUrl.match(/[?&]id=([^&]+)/);
    if (!match || !match[1]) return false; // Not a valid drive thumbnail URL

    const fileId = match[1];
    const accessToken = await getDriveAccessToken();

    try {
        const res = await fetch(`https://www.googleapis.com/drive/v3/files/${fileId}`, {
            method: 'PATCH',
            headers: {
                Authorization: `Bearer ${accessToken}`,
                'Content-Type': 'application/json',
            },
            body: JSON.stringify({ name: newName }),
        });

        if (!res.ok) throw new Error('Drive rename failed');
        return true;
    } catch (e) {
        console.error("Error renaming drive file:", e);
        return false;
    }
}

/** Check if Drive is already authorized (refresh token exists). */
export function isDriveAuthorized() {
    return !!localStorage.getItem(LS_REFRESH_TOKEN);
}

/** Clear all stored Drive tokens (logout). */
export function clearDriveTokens() {
    localStorage.removeItem(LS_REFRESH_TOKEN);
    localStorage.removeItem(LS_ACCESS_TOKEN);
    localStorage.removeItem(LS_ACCESS_EXPIRY);
    rootFolderId = null;
    productsFolderId = null;
}
