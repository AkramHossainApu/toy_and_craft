import { state } from '../core/state.js';
import { db, doc, updateDoc } from '../config/firebase.js';
import { uploadImageToDrive, isDriveAuthorized } from './drive.js';

export async function runImageMigration() {
    if (!isDriveAuthorized()) {
        alert("Please connect Google Drive first by opening the product edit modal.");
        return;
    }

    const productsToMigrate = state.inventory.filter(p => {
        if (!p.images || p.images.length === 0) {
            // Check if it has a single image field
            if (p.image && !p.image.includes('drive.google.com')) return true;
            return false;
        }
        // Check if at least one image in the array is NOT a google drive url
        return p.images.some(url => !url.includes('drive.google.com'));
    });

    if (productsToMigrate.length === 0) {
        alert("All product images are already on Google Drive!");
        return;
    }

    if (!confirm(`Found ${productsToMigrate.length} products with old image URLs. Start migration to Google Drive? This will download each image and upload it to your Drive.`)) return;

    const btn = document.getElementById('admin-migrate-btn');
    if (btn) {
        btn.disabled = true;
        btn.textContent = `Migrating (0/${productsToMigrate.length})...`;
    }

    let successCount = 0;
    let failCount = 0;

    for (let i = 0; i < productsToMigrate.length; i++) {
        const product = productsToMigrate[i];
        console.log(`Migrating [${i + 1}/${productsToMigrate.length}]: ${product.name}`);

        if (btn) btn.textContent = `Migrating (${i + 1}/${productsToMigrate.length})...`;

        try {
            const newUrls = [];
            const oldImages = (product.images && product.images.length > 0) ? product.images : (product.image ? [product.image] : []);

            for (const oldUrl of oldImages) {
                if (oldUrl.includes('drive.google.com')) {
                    newUrls.push(oldUrl);
                    continue;
                }

                // Fetch image as blob
                const res = await fetch(oldUrl);
                if (!res.ok) throw new Error(`HTTP error ${res.status} fetching ${oldUrl}`);
                const blob = await res.blob();

                // Create a File object
                const ext = oldUrl.split('.').pop().split('?')[0] || 'jpg';
                const file = new File([blob], `migrated_${product.id}_${Date.now()}.${ext}`, { type: blob.type || 'image/jpeg' });

                // Upload to Drive
                const catSlug = product.categoryId || 'products';
                const driveUrl = await uploadImageToDrive(file, catSlug);
                newUrls.push(driveUrl);
            }

            // Update Firebase
            await updateDoc(doc(db, 'products', product.id), {
                images: newUrls,
                image: newUrls[0] || product.image
            });
            successCount++;
        } catch (e) {
            console.error(`Failed migrating product ${product.id}`, e);
            failCount++;
        }
    }

    if (btn) {
        btn.disabled = false;
        btn.textContent = "Images Migrated";
    }

    alert(`Migration complete.\nSuccessful: ${successCount}\nFailed: ${failCount}\nPlease reload the page to see changes.`);
}
