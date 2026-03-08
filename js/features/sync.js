import { state } from '../core/state.js';
import { db, doc, updateDoc } from '../config/firebase.js';
import { isDriveAuthorized, getDriveAccessToken } from './drive.js';

/**
 * Searches Google Drive for files matching the product name convention 
 * (e.g., product-name-1.jpg, product-name-2.webp) and links them to Firebase.
 */
export async function syncDriveImages() {
    if (!isDriveAuthorized()) {
        alert("Please connect Google Drive first by opening the product edit modal.");
        return;
    }

    if (!confirm(`Start Sync? This will scan your connected Google Drive for images matching your product names and update the database so they appear on the site.`)) return;

    const btn = document.getElementById('admin-sync-btn');
    if (btn) {
        btn.disabled = true;
        btn.textContent = `Syncing (0/${state.inventory.length})...`;
    }

    let updatedCount = 0;
    const accessToken = await getDriveAccessToken();

    for (let i = 0; i < state.inventory.length; i++) {
        const product = state.inventory[i];
        if (btn) btn.textContent = `Syncing (${i + 1}/${state.inventory.length})...`;

        try {
            const baseName = product.name.trim() || 'product';
            const safeBaseName = baseName.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/(^-|-$)/g, '');

            // Search Drive for files that start with `safeBaseName-`
            // Drive API query: name contains 'safeBaseName-'
            const q = `name contains '${safeBaseName}-' and mimeType contains 'image/' and trashed=false`;
            const searchRes = await fetch(
                `https://www.googleapis.com/drive/v3/files?q=${encodeURIComponent(q)}&fields=files(id,name)`,
                { headers: { Authorization: `Bearer ${accessToken}` } }
            );

            const searchData = await searchRes.json();

            if (searchData.files && searchData.files.length > 0) {
                // Filter specifically for names matching exact pattern `safeBaseName-NUMBER.ext`
                const regex = new RegExp(`^${safeBaseName}-\\d+\\.[a-zA-Z0-9]+$`, 'i');
                const matchingFiles = searchData.files.filter(f => regex.test(f.name));

                // Sort by the number in the filename naturally so -1 is before -2
                matchingFiles.sort((a, b) => {
                    const numA = parseInt(a.name.match(/-(\d+)\./)?.[1] || '0');
                    const numB = parseInt(b.name.match(/-(\d+)\./)?.[1] || '0');
                    return numA - numB;
                });

                if (matchingFiles.length > 0) {
                    const newUrls = matchingFiles.map(f => `https://drive.google.com/thumbnail?id=${f.id}&sz=w800`);

                    // Only update if it actually changed to save DB writes
                    const oldImagesStr = (product.images || []).join(',');
                    const newImagesStr = newUrls.join(',');

                    if (oldImagesStr !== newImagesStr) {
                        await updateDoc(doc(db, 'Products', product.categoryId, 'Items', product.id), {
                            images: newUrls,
                            image: newUrls[0]
                        });
                        console.log(`Synced ${matchingFiles.length} images for ${product.name}`);
                        updatedCount++;
                    }
                }
            }
        } catch (e) {
            console.error(`Failed to sync product ${product.id}`, e);
        }
    }

    if (btn) {
        btn.disabled = false;
        btn.textContent = "Sync Complete!";
        setTimeout(() => { btn.textContent = "Sync Images"; }, 3000);
    }

    alert(`Sync completed! ${updatedCount} products were updated with new Drive images.\nPlease reload the page to see the changes.`);
}
