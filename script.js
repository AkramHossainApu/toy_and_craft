import { initializeApp } from "https://www.gstatic.com/firebasejs/12.6.0/firebase-app.js";
import { getFirestore, collection, getDocs, addDoc, setDoc, doc, deleteDoc } from "https://www.gstatic.com/firebasejs/12.6.0/firebase-firestore.js";

const adminHash = '687cdf3caeaa888b000edf4a01d128e3b32026b04fe248aa30ab2faba6d34033';

// Firebase config and init
const firebaseConfig = {
    apiKey: "AIzaSyARQW48lm5jEavNwCDG7tKlolxJPg1ggLg",
    authDomain: "toyandcraftstore.firebaseapp.com",
    projectId: "toyandcraftstore",
    storageBucket: "toyandcraftstore.firebasestorage.app",
    messagingSenderId: "732577086084",
    appId: "1:732577086084:web:9f5db5dce1491124aaa0d1"
};
const app = initializeApp(firebaseConfig);
const db = getFirestore(app);

// Make sure defaultProducts is fully populated with all products
const defaultProducts = [
  {
    id: "bounce-tiger",
    name: "Bounce Tiger",
    image: "assets/images/bounce tiger.jpg",
    stock: 0,
    price: 0,
    offerPrice: 0
  },
  {
    id: "cinderella",
    name: "Cinderella",
    image: "assets/images/cinderella.jpg",
    stock: 0,
    price: 0,
    offerPrice: 0
  },
  {
    id: "crab-boss",
    name: "Crab Boss",
    image: "assets/images/crab boss.jpg",
    stock: 0,
    price: 0,
    offerPrice: 0
  },
  {
    id: "kulomi",
    name: "kulomi",
    image: "assets/images/kulomi.jpg",
    stock: 0,
    price: 0,
    offerPrice: 0
  },
  {
    id: "daffy-bear",
    name: "Daffy Bear",
    image: "assets/images/daffy bear.jpg",
    stock: 0,
    price: 0,
    offerPrice: 0
  },
  {
    id: "daisy",
    name: "Daisy",
    image: "assets/images/daisy.jpg",
    stock: 0,
    price: 0,
    offerPrice: 0
  },
  {
    id: "donald-duck",
    name: "Donald Duck",
    image: "assets/images/donald duck.jpg",
    stock: 0,
    price: 0,
    offerPrice: 0
  },
  {
    id: "F3022",
    name: "F3022",
    image: "assets/images/F3022.jpg",
    stock: 0,
    price: 0,
    offerPrice: 0
  },
  {
    id: "F3023",
    name: "F3023",
    image: "assets/images/F3023.jpg",
    stock: 0,
    price: 0,
    offerPrice: 0
  },
  {
    id: "F3024",
    name: "F3024",
    image: "assets/images/F3024.jpg",
    stock: 0,
    price: 0,
    offerPrice: 0
  },
  {
    id: "F3027",
    name: "F3027",
    image: "assets/images/F3027.jpg",
    stock: 0,
    price: 0,
    offerPrice: 0
  },
  {
    id: "F3028",
    name: "F3028",
    image: "assets/images/F3028.jpg",
    stock: 0,
    price: 0,
    offerPrice: 0
  },
  {
    id: "F3031",
    name: "F3031",
    image: "assets/images/F3031.jpg",
    stock: 0,
    price: 0,
    offerPrice: 0
  },
  {
    id: "F3033",
    name: "F3033",
    image: "assets/images/F3033.jpg",
    stock: 0,
    price: 0,
    offerPrice: 0
  },
  {
    id: "F3034",
    name: "F3034",
    image: "assets/images/F3034.jpg",
    stock: 0,
    price: 0,
    offerPrice: 0
  },
  {
    id: "F3035",
    name: "F3035",
    image: "assets/images/F3035.jpg",
    stock: 0,
    price: 0,
    offerPrice: 0
  },
  {
    id: "F3039",
    name: "F3039",
    image: "assets/images/F3039.jpg",
    stock: 0,
    price: 0,
    offerPrice: 0
  },
  {
    id: "F3041",
    name: "F3041",
    image: "assets/images/F3041.jpg",
    stock: 0,
    price: 0,
    offerPrice: 0
  },
  {
    id: "F3045",
    name: "F3045",
    image: "assets/images/F3045.jpg",
    stock: 0,
    price: 0,
    offerPrice: 0
  },
  {
    id: "F3046",
    name: "F3046",
    image: "assets/images/F3046.jpg",
    stock: 0,
    price: 0,
    offerPrice: 0
  },
  {
    id: "flower-cat",
    name: "Flower Cat",
    image: "assets/images/flower cat.jpg",
    stock: 0,
    price: 0,
    offerPrice: 0
  },
  {
    id: "H09",
    name: "H09",
    image: "assets/images/H09.jpg",
    stock: 0,
    price: 0,
    offerPrice: 0
  },
  {
    id: "H17",
    name: "H17",
    image: "assets/images/H17.jpg",
    stock: 0,
    price: 0,
    offerPrice: 0
  },
  {
    id: "hello-kitty",
    name: "Hello Kitty",
    image: "assets/images/hello kitty.jpg",
    stock: 0,
    price: 0,
    offerPrice: 0
  },
  {
    id: "hibiscus-flower-260-29",
    name: "Hibiscus Flower 260 29",
    image: "assets/images/Hibiscus flower 260-29.jpg",
    stock: 0,
    price: 0,
    offerPrice: 0
  },
  {
    id: "jera-cat",
    name: "Jera Cat",
    image: "assets/images/jera cat.jpg",
    stock: 0,
    price: 0,
    offerPrice: 0
  },
  {
    id: "keqian",
    name: "Keqian",
    image: "assets/images/keqian.jpg",
    stock: 0,
    price: 0,
    offerPrice: 0
  },
  {
    id: "mandala-flower-260-31",
    name: "Mandala Flower 260 31",
    image: "assets/images/Mandala flower 260-31.jpg",
    stock: 0,
    price: 0,
    offerPrice: 0
  },
  {
    id: "mary-red",
    name: "Mary Red",
    image: "assets/images/mary red.jpg",
    stock: 0,
    price: 0,
    offerPrice: 0
  },
  {
    id: "meile-rabbit",
    name: "Meile Rabbit",
    image: "assets/images/meile rabbit.jpg",
    stock: 0,
    price: 0,
    offerPrice: 0
  },
  {
    id: "nabell",
    name: "Nabell",
    image: "assets/images/nabell.jpg",
    stock: 0,
    price: 0,
    offerPrice: 0
  },
  {
    id: "nick",
    name: "Nick",
    image: "assets/images/nick.jpg",
    stock: 0,
    price: 0,
    offerPrice: 0
  },
  {
    id: "pacha-dog",
    name: "Pacha Dog",
    image: "assets/images/pacha dog.jpg",
    stock: 0,
    price: 0,
    offerPrice: 0
  },
  {
    id: "pie-star",
    name: "Pie Star",
    image: "assets/images/pie star.jpg",
    stock: 0,
    price: 0,
    offerPrice: 0
  },
  {
    id: "pikachu",
    name: "Pikachu",
    image: "assets/images/pikachu.jpg",
    stock: 0,
    price: 0,
    offerPrice: 0
  },
  {
    id: "Q5044",
    name: "Q5044",
    image: "assets/images/Q5044.jpg",
    stock: 0,
    price: 0,
    offerPrice: 0
  },
  {
    id: "Q5045",
    name: "Q5045",
    image: "assets/images/Q5045.jpg",
    stock: 0,
    price: 0,
    offerPrice: 0
  },
  {
    id: "Q5046",
    name: "Q5046",
    image: "assets/images/Q5046.jpg",
    stock: 0,
    price: 0,
    offerPrice: 0
  },
  {
    id: "Q5047",
    name: "Q5047",
    image: "assets/images/Q5047.jpg",
    stock: 0,
    price: 0,
    offerPrice: 0
  },
  {
    id: "Q5048",
    name: "Q5048",
    image: "assets/images/Q5048.jpg",
    stock: 0,
    price: 0,
    offerPrice: 0
  },
  {
    id: "Q5051",
    name: "Q5051",
    image: "assets/images/Q5051.jpg",
    stock: 0,
    price: 0,
    offerPrice: 0
  },
  {
    id: "Q5053",
    name: "Q5053",
    image: "assets/images/Q5053.jpg",
    stock: 0,
    price: 0,
    offerPrice: 0
  },
  {
    id: "Q5054",
    name: "Q5054",
    image: "assets/images/Q5054.jpg",
    stock: 0,
    price: 0,
    offerPrice: 0
  },
  {
    id: "qiqi-mouse",
    name: "Qiqi Mouse",
    image: "assets/images/qiqi mouse.jpg",
    stock: 0,
    price: 0,
    offerPrice: 0
  },
  {
    id: "red-panda-drinking-coconut-juice",
    name: "Red Panda   Drinking Coconut Juice",
    image: "assets/images/Red panda - drinking coconut juice.jpg",
    stock: 0,
    price: 0,
    offerPrice: 0
  },
  {
    id: "red-panda-eat-bamboo",
    name: "Red Panda   Eat Bamboo",
    image: "assets/images/Red panda - eat bamboo.jpg",
    stock: 0,
    price: 0,
    offerPrice: 0
  },
  {
    id: "red-panda-eat-watermelon",
    name: "Red Panda   Eat Watermelon",
    image: "assets/images/Red panda - eat watermelon.jpg",
    stock: 0,
    price: 0,
    offerPrice: 0
  },
  {
    id: "red-panda-eating-cake",
    name: "Red Panda   Eating Cake",
    image: "assets/images/Red panda - eating cake.jpg",
    stock: 0,
    price: 0,
    offerPrice: 0
  },
  {
    id: "red-panda-eating-pumpkin",
    name: "Red Panda   Eating Pumpkin",
    image: "assets/images/Red panda - eating pumpkin.jpg",
    stock: 0,
    price: 0,
    offerPrice: 0
  },
  {
    id: "red-panda-grass-sliding-board",
    name: "Red Panda   Grass Sliding Board",
    image: "assets/images/Red panda - grass sliding board.jpg",
    stock: 0,
    price: 0,
    offerPrice: 0
  },
  {
    id: "red-panda-holding-apple",
    name: "Red Panda   Holding Apple",
    image: "assets/images/Red panda - holding apple.jpg",
    stock: 0,
    price: 0,
    offerPrice: 0
  },
  {
    id: "red-panda-rocking-chair",
    name: "Red Panda   Rocking Chair",
    image: "assets/images/Red panda - rocking chair.jpg",
    stock: 0,
    price: 0,
    offerPrice: 0
  },
  {
    id: "red-panda-scooter",
    name: "Red Panda   Scooter",
    image: "assets/images/Red panda - scooter.jpg",
    stock: 0,
    price: 0,
    offerPrice: 0
  },
  {
    id: "red-panda-sunshine-bath",
    name: "Red Panda   Sunshine Bath",
    image: "assets/images/Red panda - sunshine bath.jpg",
    stock: 0,
    price: 0,
    offerPrice: 0
  },
  {
    id: "red-panda-swimming-ring",
    name: "Red Panda   Swimming Ring",
    image: "assets/images/Red panda - swimming ring.jpg",
    stock: 0,
    price: 0,
    offerPrice: 0
  },
  {
    id: "red-panda-wooden-climbing-pile",
    name: "Red Panda   Wooden Climbing Pile",
    image: "assets/images/Red panda - wooden climbing pile.jpg",
    stock: 0,
    price: 0,
    offerPrice: 0
  },
  {
    id: "shirley-rose",
    name: "Shirley Rose",
    image: "assets/images/shirley rose.jpg",
    stock: 0,
    price: 0,
    offerPrice: 0
  },
  {
    id: "single-crystal-pink-rose",
    name: "Single Crystal Pink Rose",
    image: "assets/images/single crystal pink rose.jpg",
    stock: 0,
    price: 0,
    offerPrice: 0
  },
  {
    id: "single-crystal-red-rose",
    name: "Single Crystal Red Rose",
    image: "assets/images/single crystal red rose.jpg",
    stock: 0,
    price: 0,
    offerPrice: 0
  },
  {
    id: "single-pink-rose-double-form",
    name: "Single Pink Rose Double Form",
    image: "assets/images/Single Pink Rose-Double Form.jpg",
    stock: 0,
    price: 0,
    offerPrice: 0
  },
  {
    id: "single-red-rose-double-form",
    name: "Single Red Rose Double Form",
    image: "assets/images/Single Red Rose-Double Form.jpg",
    stock: 0,
    price: 0,
    offerPrice: 0
  },
  {
    id: "small-sponge",
    name: "Small Sponge",
    image: "assets/images/small sponge.jpg",
    stock: 0,
    price: 0,
    offerPrice: 0
  },
  {
    id: "snow-white",
    name: "Snow White",
    image: "assets/images/snow white.jpg",
    stock: 0,
    price: 0,
    offerPrice: 0
  },
  {
    id: "squidward",
    name: "Squidward",
    image: "assets/images/squidward.jpg",
    stock: 0,
    price: 0,
    offerPrice: 0
  },
  {
    id: "star-dailu",
    name: "Star Dailu",
    image: "assets/images/star dailu.jpg",
    stock: 0,
    price: 0,
    offerPrice: 0
  },
  {
    id: "stitch",
    name: "Stitch",
    image: "assets/images/stitch.jpg",
    stock: 0,
    price: 0,
    offerPrice: 0
  },
  {
    id: "three-eyes",
    name: "Three Eyes",
    image: "assets/images/three eyes.jpg",
    stock: 0,
    price: 0,
    offerPrice: 0
  },
  {
    id: "tulip-260-28",
    name: "Tulip 260 28",
    image: "assets/images/Tulip 260-28.jpg",
    stock: 0,
    price: 0,
    offerPrice: 0
  },
  {
    id: "w1522-02-calico-cat",
    name: "W1522 02 Calico Cat",
    image: "assets/images/W1522-02 calico cat.jpg",
    stock: 0,
    price: 0,
    offerPrice: 0
  },
  {
    id: "w1523-02-british-short-blue-cat",
    name: "W1523 02 British Short Blue Cat",
    image: "assets/images/W1523-02 british short blue cat.jpg",
    stock: 0,
    price: 0,
    offerPrice: 0
  },
  {
    id: "w1523-03-british-short-blue-and-white",
    name: "W1523 03 British Short Blue And White",
    image: "assets/images/W1523-03 british short blue and white.jpg",
    stock: 0,
    price: 0,
    offerPrice: 0
  },
  {
    id: "w1523-05-cow-cat",
    name: "W1523 05 Cow Cat",
    image: "assets/images/W1523-05 cow cat.jpg",
    stock: 0,
    price: 0,
    offerPrice: 0
  },
  {
    id: "w1526-01-papillon",
    name: "W1526 01 Papillon",
    image: "assets/images/W1526-01 papillon.jpg",
    stock: 0,
    price: 0,
    offerPrice: 0
  },
  {
    id: "w1526-04-doberman-pinscher",
    name: "W1526 04 Doberman Pinscher",
    image: "assets/images/W1526-04 doberman pinscher.jpg",
    stock: 0,
    price: 0,
    offerPrice: 0
  },
  {
    id: "w1526-05-pastoral-dog-brown",
    name: "W1526 05 Pastoral Dog Brown",
    image: "assets/images/W1526-05 pastoral dog brown.jpg",
    stock: 0,
    price: 0,
    offerPrice: 0
  },
  {
    id: "w1527-05-shiba-inu",
    name: "W1527 05 Shiba Inu",
    image: "assets/images/W1527-05 shiba inu.jpg",
    stock: 0,
    price: 0,
    offerPrice: 0
  },
  {
    id: "w1528-01-short-haired-soil-pine",
    name: "W1528 01 Short Haired Soil Pine",
    image: "assets/images/W1528-01 short-haired soil pine.jpg",
    stock: 0,
    price: 0,
    offerPrice: 0
  },
  {
    id: "w1528-02-five-red-dogs",
    name: "W1528 02 Five Red Dogs",
    image: "assets/images/W1528-02 five red dogs.jpg",
    stock: 0,
    price: 0,
    offerPrice: 0
  },
  {
    id: "w1528-03-four-eyebrow-dog",
    name: "W1528 03 Four Eyebrow Dog",
    image: "assets/images/W1528-03 four eyebrow dog.jpg",
    stock: 0,
    price: 0,
    offerPrice: 0
  },
  {
    id: "w1528-04-chaozhou-dog",
    name: "W1528 04 Chaozhou Dog",
    image: "assets/images/W1528-04 chaozhou dog.jpg",
    stock: 0,
    price: 0,
    offerPrice: 0
  },
  {
    id: "white-lily-260-24",
    name: "White Lily 260 24",
    image: "assets/images/White lily 260-24.jpg",
    stock: 0,
    price: 0,
    offerPrice: 0
  }
];

// App State
let inventory = [];
let isLoggedIn = false;
let isAdmin = false;
let editingProductId = null;

// DOM Elements
const grid = document.getElementById('product-grid');
const adminLoginBtn = document.getElementById('admin-login-btn');
const adminPanel = document.getElementById('admin-panel');
const logoutBtn = document.getElementById('logout-btn');

const loginModal = document.getElementById('login-modal');
const editModal = document.getElementById('edit-modal');
const closeModals = document.querySelectorAll('.close-modal');

// Login inputs in the modal
const loginNameInput = document.getElementById('login-name');
const loginPasswordInput = document.getElementById('login-password');
const loginError = document.getElementById('login-error');
const openSignupLink = document.getElementById('open-signup-link');
const openLoginLink = document.getElementById('open-login-link');

// Edit product inputs
const editName = document.getElementById('edit-product-name');
const editImage = document.getElementById('edit-product-image');
const stockInput = document.getElementById('stock-input');
const priceInput = document.getElementById('price-input');
const offerPriceInput = document.getElementById('offer-price-input');
const saveStockBtn = document.getElementById('save-stock-btn');

// DOM refs for new controls
const searchInput = document.getElementById('search-input');
const sortSelect = document.getElementById('sort-select');
const editNameInput = document.getElementById('edit-name-input');
const editImageInput = document.getElementById('edit-image-input');
const editImageUpload = document.getElementById('edit-image-upload');

// Product modal logic for users
const productViewModal = document.getElementById('product-view-modal');
const closeProductModal = document.getElementById('close-product-modal');
const viewProductName = document.getElementById('view-product-name');
const viewProductImage = document.getElementById('view-product-image');
const viewProductPrices = document.getElementById('view-product-prices');
const viewProductQty = document.getElementById('view-product-qty');
const viewProductQtyGroup = document.getElementById('view-product-qty-group');
const viewProductOut = document.getElementById('view-product-out');

// --- Initialization ---

function init() {
    loadInventory();
    renderProducts();
    setupEventListeners();
}

async function loadInventory() {
    try {
        const snapshot = await getDocs(collection(db, 'Products'));
        if (snapshot.empty) {
            for (const p of defaultProducts) {
                await addDoc(collection(db, 'Products'), p);
            }
            const seededSnapshot = await getDocs(collection(db, 'Products'));
            inventory = seededSnapshot.docs.map(doc => doc.data());
        } else {
            inventory = snapshot.docs.map(doc => doc.data());
        }
        renderProducts();
    } catch (e) {
        console.error('Error loading inventory:', e);
        const saved = localStorage.getItem('toyStoreInventory');
        if (saved) {
            inventory = JSON.parse(saved);
        } else {
            inventory = JSON.parse(JSON.stringify(defaultProducts));
        }
        renderProducts();
    }
}

// Add a simple loading indicator
const loadingIndicator = document.createElement('div');
loadingIndicator.id = 'loading-indicator';
loadingIndicator.style.position = 'fixed';
loadingIndicator.style.top = '0';
loadingIndicator.style.left = '0';
loadingIndicator.style.width = '100vw';
loadingIndicator.style.height = '100vh';
loadingIndicator.style.background = 'rgba(255,255,255,0.6)';
loadingIndicator.style.display = 'flex';
loadingIndicator.style.alignItems = 'center';
loadingIndicator.style.justifyContent = 'center';
loadingIndicator.style.fontSize = '2em';
loadingIndicator.style.zIndex = '9999';
loadingIndicator.style.color = '#333';
loadingIndicator.innerHTML = '<span>Saving, please wait...</span>';
document.body.appendChild(loadingIndicator);
loadingIndicator.style.display = 'none';

async function saveInventory() {
    loadingIndicator.style.display = 'flex';
    // Remove all docs and re-add (for admin update)
    const snapshot = await getDocs(collection(db, 'Products'));
    for (const d of snapshot.docs) {
        await deleteDoc(doc(db, 'Products', d.id));
    }
    for (const p of inventory) {
        await addDoc(collection(db, 'Products'), p);
    }
    localStorage.setItem('toyStoreInventory', JSON.stringify(inventory));
    loadingIndicator.style.display = 'none';
}

// --- Rendering ---

// Add a per-product saving indicator
function setProductSaving(id, saving) {
    const card = document.querySelector(`.card[data-id='${id}']`);
    if (card) {
        let indicator = card.querySelector('.saving-indicator');
        if (saving) {
            if (!indicator) {
                indicator = document.createElement('div');
                indicator.className = 'saving-indicator';
                indicator.innerHTML = '<div class="bar"></div>';
                card.appendChild(indicator);
            }
            indicator.style.display = 'block';
        } else if (indicator) {
            indicator.style.display = 'none';
        }
    }
}

async function saveProduct(product) {
    setProductSaving(product.id, true);
    // Find the Firestore doc for this product by id (if exists)
    const snapshot = await getDocs(collection(db, 'Products'));
    let docId = null;
    snapshot.forEach(docSnap => {
        if (docSnap.data().id === product.id) docId = docSnap.id;
    });
    if (docId) {
        await setDoc(doc(db, 'Products', docId), product);
    } else {
        await addDoc(collection(db, 'Products'), product);
    }
    setProductSaving(product.id, false);
}

function renderProducts() {
    console.log('renderProducts called, inventory:', inventory);
    grid.innerHTML = '';
    let filtered = inventory.slice();
    const searchVal = searchInput ? searchInput.value.trim().toLowerCase() : '';
    if (searchVal) {
        filtered = filtered.filter(p => p.name.toLowerCase().includes(searchVal));
    }
    const sortVal = sortSelect ? sortSelect.value : 'default';
    if (sortVal === "price-asc") {
        filtered.sort((a, b) => ((a.offerPrice && a.offerPrice > 0 ? a.offerPrice : a.price) || 0) - ((b.offerPrice && b.offerPrice > 0 ? b.offerPrice : b.price) || 0));
    } else if (sortVal === "price-desc") {
        filtered.sort((a, b) => ((b.offerPrice && b.offerPrice > 0 ? b.offerPrice : b.price) || 0) - ((a.offerPrice && a.offerPrice > 0 ? a.offerPrice : a.price) || 0));
    } else if (sortVal === "stock") {
        filtered = filtered.filter(p => p.stock > 0);
    } else if (sortVal === "out") {
        filtered = filtered.filter(p => p.stock === 0);
    }
    if (filtered.length === 0) {
        grid.innerHTML = '<div style="text-align:center;color:#d32f2f;font-weight:bold;">No products found.</div>';
        return;
    }
    filtered.forEach(product => {
        const card = document.createElement('div');
        card.className = 'card';
        card.setAttribute('data-id', product.id);
        let stockClass = 'stock-high';
        let stockText = `In Stock: ${product.stock}`;
        if (product.stock === 0) {
            stockClass = 'stock-out';
            stockText = 'Out of Stock';
        } else if (product.stock < 3) {
            stockClass = 'stock-low';
            stockText = `Low on Stock: ${product.stock}`;
        }
        // Only show edit if isAdmin is true
        let priceHtml = '';
        if (product.offerPrice && product.offerPrice > 0) {
            priceHtml = `<span class='price-tag'>৳${product.offerPrice.toFixed(2)}</span> <span class='regular-price'><s>৳${product.price.toFixed(2)}</s></span>`;
        } else {
            priceHtml = `<span class='price-tag'>৳${product.price.toFixed(2)}</span>`;
        }
        // Offer badge
        let offerBadge = '';
        if (product.offerPrice && product.offerPrice > 0 && product.price > 0 && product.offerPrice < product.price) {
            const percent = Math.round(100 - (product.offerPrice / product.price) * 100);
            offerBadge = `<div class="offer-badge">-${percent}%</div>`;
        }
        card.innerHTML = `
            <div class="card-img-container" onclick="openProductModal('${product.id}')">
                ${offerBadge}
                <img src="${product.image}" alt="${product.name}" class="card-img" loading="lazy">
            </div>
            <div class="card-title">${product.name}</div>
            <div>${priceHtml}</div>
            ${isAdmin ? `<div class="stock-status ${stockClass}">${stockText}</div><button class="edit-btn" onclick="openEditModal('${product.id}');event.stopPropagation();">Update Stock ✏️</button>` : (product.stock === 0 ? `<div class="stock-status ${stockClass}">${stockText}</div>` : '')}
        `;
        grid.appendChild(card);
    });
}

function toggleAdminView() {
    // Always hide login and show profile icon after login (admin or user)
    if (isAdmin) {
        if (adminLoginBtn) adminLoginBtn.classList.add('hidden');
        if (adminPanel) adminPanel.classList.remove('hidden');
        showProfileIcon({ name: 'Admin' });
    } else if (currentUser) {
        if (adminLoginBtn) adminLoginBtn.classList.add('hidden');
        if (adminPanel) adminPanel.classList.add('hidden');
        showProfileIcon(currentUser);
    } else {
        if (adminLoginBtn) adminLoginBtn.classList.remove('hidden');
        if (adminPanel) adminPanel.classList.add('hidden');
        hideProfileIcon();
    }
    renderProducts();
}

// --- Event Listeners ---

function setupEventListeners() {
    // Modal Closing
    closeModals.forEach(btn => {
        btn.addEventListener('click', () => {
            loginModal.classList.add('hidden');
            editModal.classList.add('hidden');
            loginError.classList.add('hidden');
            if (loginPasswordInput) loginPasswordInput.value = '';
            if (loginNameInput) loginNameInput.value = '';
            // Hide admin login div if present
            const adminDiv = document.getElementById('admin-login-div');
            if (adminDiv) adminDiv.classList.add('hidden');
        });
    });

    window.addEventListener('click', (e) => {
        if (e.target === loginModal) {
            loginModal.classList.add('hidden');
            loginError.classList.add('hidden');
            if (loginPasswordInput) loginPasswordInput.value = '';
            if (loginNameInput) loginNameInput.value = '';
        }
        if (e.target === editModal) editModal.classList.add('hidden');
    });

    // Login
    adminLoginBtn.addEventListener('click', () => {
        loginModal.classList.remove('hidden');
        // show login tab by default
        if (showLoginBtn) showLoginBtn.click();
        setTimeout(() => {
            if (loginNameInput) loginNameInput.focus();
        }, 120);
    });

    // allow Enter on password input to submit the login form
    if (loginPasswordInput) {
        loginPasswordInput.addEventListener('keypress', (e) => {
            if (e.key === 'Enter') {
                e.preventDefault();
                handleLogin();
            }
        });
    }

    // Open signup when user clicks the inline link
    if (openSignupLink) {
        openSignupLink.addEventListener('click', (e) => {
            e.preventDefault();
            // switch modal to signup form
            loginForm.classList.add('hidden');
            signupForm.classList.remove('hidden');
            if (document.getElementById('signup-name')) document.getElementById('signup-name').focus();
            // Hide admin login div if present
            const adminDiv = document.getElementById('admin-login-div');
            if (adminDiv) adminDiv.classList.add('hidden');
        });
    }
    // Open login when user clicks the inline link in signup
    if (openLoginLink) {
        openLoginLink.addEventListener('click', (e) => {
            e.preventDefault();
            signupForm.classList.add('hidden');
            loginForm.classList.remove('hidden');
            if (loginNameInput) loginNameInput.focus();
            // Hide admin login div if present
            const adminDiv = document.getElementById('admin-login-div');
            if (adminDiv) adminDiv.classList.add('hidden');
        });
    }

    // Logout
    logoutBtn.addEventListener('click', () => {
        isLoggedIn = false;
        toggleAdminView();
    });

    // Save Stock
    saveStockBtn.addEventListener('click', handleSaveStock);
    if (searchInput) searchInput.addEventListener('input', renderProducts);
    if (sortSelect) sortSelect.addEventListener('change', renderProducts);
}

// --- Login Logic ---

async function handleLogin() {
    const password = (loginPasswordInput && loginPasswordInput.value) || '';
    const hash = await sha256(password);

    if (hash === adminHash) {
        isLoggedIn = true;
        isAdmin = true;
        loginModal.classList.add('hidden');
        if (loginPasswordInput) loginPasswordInput.value = '';
        loginError.classList.add('hidden');
        toggleAdminView();
    } else {
        loginError.classList.remove('hidden');
        // Shake animation
        const content = loginModal.querySelector('.modal-content');
        content.style.animation = 'none';
        content.offsetHeight; /* trigger reflow */
        content.style.animation = 'slideUp 0.3s'; // Re-trigger entry or could define a shake
    }
}

// Helper: SHA-256 implementation using Web Crypto API
async function sha256(message) {
    const msgBuffer = new TextEncoder().encode(message);
    const hashBuffer = await crypto.subtle.digest('SHA-256', msgBuffer);
    const hashArray = Array.from(new Uint8Array(hashBuffer));
    const hashHex = hashArray.map(b => b.toString(16).padStart(2, '0')).join('');
    return hashHex;
}

// --- Edit Logic ---

// Defined globally so it can be called from HTML onclick
window.openEditModal = function(id) {
    const product = inventory.find(p => p.id === id);
    if (!product) return;
    editingProductId = id;
    editName.textContent = product.name;
    editImage.src = product.image;
    if (editNameInput) editNameInput.value = product.name;
    if (editImageInput) editImageInput.value = product.image;
    if (editImageUpload) editImageUpload.value = '';
    stockInput.value = product.stock;
    if (priceInput) priceInput.value = product.price || 0;
    if (offerPriceInput) offerPriceInput.value = product.offerPrice || 0;
    editModal.classList.remove('hidden');
}

if (editImageUpload) {
    editImageUpload.addEventListener('change', function() {
        const file = this.files[0];
        if (!file) return;
        const reader = new FileReader();
        reader.onload = function(e) {
            editImage.src = e.target.result;
            editImage.classList.remove('zoomed');
        };
        reader.readAsDataURL(file);
    });
}

async function handleSaveStock() {
    console.log('handleSaveStock called');
    const newStock = parseInt(stockInput.value);
    const newPrice = parseFloat(priceInput.value);
    const newOfferPrice = parseFloat(offerPriceInput.value);
    if (isNaN(newStock) || newStock < 0) {
        alert("Please enter a valid stock number.");
        return;
    }
    if (priceInput.value === '' || isNaN(newPrice) || newPrice < 0) {
        alert("Price is required and must be 0 or greater.");
        return;
    }
    if (offerPriceInput.value !== '' && (isNaN(newOfferPrice) || newOfferPrice < 0)) {
        alert("Please enter a valid offer price.");
        return;
    }
    const product = inventory.find(p => p.id === editingProductId);
    if (product) {
        product.stock = newStock;
        product.price = newPrice;
        product.offerPrice = offerPriceInput.value !== '' ? newOfferPrice : 0;
        editModal.classList.add('hidden'); // Instantly close modal
        await saveProduct(product);
        renderProducts();
    }
}

// Product modal logic for users
window.openProductModal = function(id) {
    if (isAdmin) return; // Only for normal users
    const product = inventory.find(p => p.id === id);
    if (!product) return;
    viewProductName.textContent = product.name;
    viewProductImage.src = product.image;
    viewProductImage.alt = product.name;
    if (product.offerPrice && product.offerPrice > 0) {
        viewProductPrices.innerHTML = `<span class='price-tag'>৳${product.offerPrice.toFixed(2)}</span> <span class='regular-price'><s>৳${product.price.toFixed(2)}</s></span>`;
    } else {
        viewProductPrices.innerHTML = `<span class='price-tag'>৳${product.price.toFixed(2)}</span>`;
    }
    if (product.stock > 0) {
        viewProductQtyGroup.style.display = '';
        viewProductQty.max = product.stock;
        viewProductQty.value = 1;
        viewProductQty.disabled = false;
        viewProductOut.style.display = 'none';
    } else {
        viewProductQtyGroup.style.display = 'none';
        viewProductOut.style.display = '';
    }
    productViewModal.classList.remove('hidden');
}

if (closeProductModal) closeProductModal.onclick = function() {
    productViewModal.classList.add('hidden');
}

// Zoom logic
if (viewProductImage) {
    let zoomed = false;
    viewProductImage.onclick = function() {
        zoomed = !zoomed;
        if (zoomed) {
            viewProductImage.classList.add('zoomed');
            viewProductImage.style.transform = '';
            viewProductImage.style.cursor = 'zoom-out';
        } else {
            viewProductImage.classList.remove('zoomed');
            viewProductImage.style.transform = '';
            viewProductImage.style.cursor = 'zoom-in';
        }
    };
}

// --- Cart System ---
let cart = JSON.parse(localStorage.getItem('cart') || '[]');

function updateCartCount() {
    document.getElementById('cart-count').textContent = cart.reduce((sum, item) => sum + item.qty, 0);
}

function saveCart() {
    localStorage.setItem('cart', JSON.stringify(cart));
    updateCartCount();
}

function addToCart(product, qty) {
    const existing = cart.find(item => item.id === product.id);
    if (existing) {
        existing.qty = Math.min(existing.qty + qty, product.stock);
    } else {
        cart.push({ id: product.id, name: product.name, image: product.image, price: product.offerPrice && product.offerPrice > 0 ? product.offerPrice : product.price, stock: product.stock, qty: Math.min(qty, product.stock) });
    }
    saveCart();
}

function removeFromCart(id) {
    cart = cart.filter(item => item.id !== id);
    saveCart();
    renderCart();
}

function updateCartQty(id, qty) {
    const item = cart.find(i => i.id === id);
    if (item) {
        item.qty = Math.max(1, Math.min(qty, item.stock));
        saveCart();
        renderCart();
    }
}

function renderCart() {
    const cartItems = document.getElementById('cart-items');
    const cartTotal = document.getElementById('cart-total');
    const checkoutBtn = document.getElementById('checkout-btn');
    if (!cartItems || !cartTotal) return;
    if (cart.length === 0) {
        cartItems.innerHTML = '<div style="text-align:center;color:#888;">Your cart is empty.</div>';
        cartTotal.textContent = '';
        if (checkoutBtn) checkoutBtn.style.display = 'none';
        return;
    }
    let total = 0;
    cartItems.innerHTML = cart.map(item => {
        total += item.price * item.qty;
        return `<div class='cart-row'>
            <img src='${item.image}' alt='${item.name}' class='cart-thumb'>
            <span class='cart-name'>${item.name}</span>
            <span class='cart-qty-group'>
                <button class='cart-qty-btn' data-id='${item.id}' data-action='minus'>&minus;</button>
                <input type='number' min='1' max='${item.stock}' value='${item.qty}' class='cart-qty' data-id='${item.id}'>
                <button class='cart-qty-btn' data-id='${item.id}' data-action='plus'>&#43;</button>
            </span>
            <span class='cart-price'>৳${(item.price * item.qty).toFixed(2)}</span>
            <button class='cart-remove' data-id='${item.id}'>&times;</button>
        </div>`;
    }).join('');
    cartTotal.textContent = `Total: ৳${total.toFixed(2)}`;
    if (checkoutBtn) checkoutBtn.style.display = 'block';
    // Add listeners
    cartItems.querySelectorAll('.cart-remove').forEach(btn => {
        btn.onclick = e => removeFromCart(btn.dataset.id);
    });
    cartItems.querySelectorAll('.cart-qty').forEach(input => {
        input.onchange = e => updateCartQty(input.dataset.id, parseInt(input.value));
    });
    cartItems.querySelectorAll('.cart-qty-btn').forEach(btn => {
        btn.onclick = e => {
            const id = btn.dataset.id;
            const item = cart.find(i => i.id === id);
            if (!item) return;
            if (btn.dataset.action === 'plus' && item.qty < item.stock) {
                updateCartQty(id, item.qty + 1);
            } else if (btn.dataset.action === 'minus' && item.qty > 1) {
                updateCartQty(id, item.qty - 1);
            }
        };
    });
}

document.getElementById('cart-btn').onclick = function() {
    renderCart();
    document.getElementById('cart-modal').classList.remove('hidden');
};
document.getElementById('close-cart-modal').onclick = function() {
    document.getElementById('cart-modal').classList.add('hidden');
};
document.getElementById('checkout-btn').onclick = function() {
    alert('Checkout is not implemented.');
};
updateCartCount();

// Add to Cart button in product modal
const viewProductAddBtn = document.createElement('button');
viewProductAddBtn.id = 'view-product-add-btn';
viewProductAddBtn.className = 'cute-btn';
viewProductAddBtn.textContent = 'Add to Cart';
viewProductAddBtn.onclick = function() {
    const id = viewProductAddBtn.dataset.id;
    const product = inventory.find(p => p.id === id);
    const qty = parseInt(viewProductQty.value) || 1;
    if (product && product.stock > 0) {
        addToCart(product, qty);
        document.getElementById('product-view-modal').classList.add('hidden');
    }
};
// Insert Add to Cart button logic in openProductModal
const origOpenProductModal = window.openProductModal;
window.openProductModal = function(id) {
    origOpenProductModal(id);
    const product = inventory.find(p => p.id === id);
    if (!product) return;
    viewProductAddBtn.dataset.id = id;
    if (product.stock > 0) {
        if (!document.getElementById('view-product-add-btn')) {
            document.getElementById('view-product-qty-group').after(viewProductAddBtn);
        }
        viewProductAddBtn.disabled = false;
    } else {
        if (document.getElementById('view-product-add-btn')) {
            viewProductAddBtn.remove();
        }
    }
};

// --- Unified Login/Signup/Profile Logic ---
const loginBtn = document.getElementById('admin-login-btn');
const loginForm = document.getElementById('login-form');
const signupForm = document.getElementById('signup-form');
const showLoginBtn = document.getElementById('show-login');
const showSignupBtn = document.getElementById('show-signup');
const userControls = document.querySelector('.user-controls');

let currentUser = null;

function showProfileIcon(user) {
  let icon = document.getElementById('profile-icon');
  if (!icon) {
    icon = document.createElement('button');
    icon.id = 'profile-icon';
    icon.className = 'profile-icon';
    icon.title = 'Profile';
    icon.innerHTML = '👤';
    // Always append as last child for right alignment
    userControls.appendChild(icon);
  }
  icon.onclick = showProfileMenu;
  if (loginBtn) loginBtn.classList.add('hidden');
  if (adminPanel) adminPanel.classList.add('hidden');
}

function hideProfileIcon() {
  const icon = document.getElementById('profile-icon');
  if (icon) icon.remove();
  if (loginBtn) loginBtn.classList.remove('hidden');
  if (adminPanel) adminPanel.classList.add('hidden');
}

function showProfileMenu() {
  let menu = document.getElementById('profile-menu');
  if (!menu) {
    menu = document.createElement('div');
    menu.id = 'profile-menu';
    menu.className = 'profile-menu';
    document.body.appendChild(menu);
  }
  menu.innerHTML = `<div class='profile-info'><b>${currentUser?.name}</b><br>${currentUser?.number || ''}<br>${currentUser?.address || ''}</div><button id='logout-profile' class='cute-btn secondary'>Logout</button>`;
  menu.style.display = 'block';
  // Position fixed to top right (matches CSS)
  menu.style.right = '24px';
  menu.style.top = window.innerWidth < 600 ? '60px' : '70px';
  menu.style.left = '';
  document.getElementById('logout-profile').onclick = () => {
    if (isAdmin) {
      isAdmin = false;
      isLoggedIn = false;
      currentUser = null;
      hideProfileIcon();
      menu.style.display = 'none';
      adminLoginBtn.classList.remove('hidden');
      adminPanel.classList.add('hidden');
      renderProducts();
      alert('Admin logged out.');
    } else {
      currentUser = null;
      isLoggedIn = false;
      hideProfileIcon();
      menu.style.display = 'none';
      renderProducts();
    }
  };
  document.addEventListener('mousedown', function handler(e) {
    if (!menu.contains(e.target) && e.target !== document.getElementById('profile-icon')) {
      menu.style.display = 'none';
      document.removeEventListener('mousedown', handler);
    }
  });
}

loginBtn.onclick = () => {
  loginModal.classList.remove('hidden');
  loginForm.classList.remove('hidden');
  signupForm.classList.add('hidden');
  if (loginNameInput) loginNameInput.focus();
  // Hide admin login div if present
  const adminDiv = document.getElementById('admin-login-div');
  if (adminDiv) adminDiv.classList.add('hidden');
};

signupForm.onsubmit = async e => {
  e.preventDefault();
  const name = document.getElementById('signup-name').value.trim();
  const number = document.getElementById('signup-number').value.trim();
  const address = document.getElementById('signup-address').value.trim();
  const password = document.getElementById('signup-password').value;
  if (!name || !number || !address || !password) {
    document.getElementById('signup-error').textContent = 'All fields are required.';
    document.getElementById('signup-error').classList.remove('hidden');
    return;
  }
  const hash = await sha256(password);
  const usersRef = collection(db, 'Users');
  // Check if user with same name exists
  const snapshot = await getDocs(usersRef);
  let exists = false;
  snapshot.forEach(docSnap => {
    if (docSnap.data().name === name) exists = true;
  });
  if (exists) {
    document.getElementById('signup-error').textContent = 'Name already taken. Please use a different name.';
    document.getElementById('signup-error').classList.remove('hidden');
    return;
  }
  const userId = uuidv4();
  await setDoc(doc(usersRef, name), {
    id: userId,
    name,
    number,
    address,
    password: hash
  });
  document.getElementById('signup-error').classList.add('hidden');
  signupForm.reset();
  showLoginBtn.click();
  document.getElementById('login-error').textContent = 'Sign up successful! Please log in.';
  document.getElementById('login-error').classList.remove('hidden');
};

// Hide profile menu on logout or modal close
closeModals.forEach(btn => {
   btn.addEventListener('click', () => {
     const menu = document.getElementById('profile-menu');
     if (menu) menu.style.display = 'none';
   });
 });

// Add long-press admin login to logo
const logoImg = document.querySelector('.logo');
let logoPressTimer = null;
if (logoImg) {
  logoImg.addEventListener('mousedown', function (e) {
    logoPressTimer = setTimeout(() => {
      // Show admin login modal
      if (loginModal) {
        loginModal.classList.remove('hidden');
        loginForm.classList.add('hidden');
        signupForm.classList.add('hidden');
        let adminDiv = document.getElementById('admin-login-div');
        if (!adminDiv) {
          adminDiv = document.createElement('div');
          adminDiv.id = 'admin-login-div';
          adminDiv.innerHTML = `<h2>Admin Login 🗝️</h2><input type='password' id='admin-password' placeholder='Password...'><button id='admin-login-submit' class='cute-btn'>Unlock</button><p id='admin-login-error' class='error-msg hidden'></p>`;
          loginModal.querySelector('.modal-content').appendChild(adminDiv);
        }
        adminDiv.classList.remove('hidden');
        setTimeout(() => {
          const adminPassInput = document.getElementById('admin-password');
          if (adminPassInput) adminPassInput.focus();
        }, 50);
        document.getElementById('admin-login-submit').onclick = async () => {
          const pass = document.getElementById('admin-password').value;
          const hash = await sha256(pass);
          if (hash === adminHash) {
            isAdmin = true;
            isLoggedIn = true;
            currentUser = { name: 'Admin' };
            loginModal.classList.add('hidden');
            showProfileIcon(currentUser);
            adminDiv.classList.add('hidden');
            toggleAdminView();
          } else {
            document.getElementById('admin-login-error').textContent = 'Wrong password!';
            document.getElementById('admin-login-error').classList.remove('hidden');
          }
        };
      }
    }, 700); // 700ms long press
  });
  logoImg.addEventListener('mouseup', function (e) {
    clearTimeout(logoPressTimer);
  });
  logoImg.addEventListener('mouseleave', function (e) {
    clearTimeout(logoPressTimer);
  });
  logoImg.addEventListener('touchstart', function (e) {
    logoPressTimer = setTimeout(() => {
      if (loginModal) {
        loginModal.classList.remove('hidden');
        loginForm.classList.add('hidden');
        signupForm.classList.add('hidden');
        let adminDiv = document.getElementById('admin-login-div');
        if (!adminDiv) {
          adminDiv = document.createElement('div');
          adminDiv.id = 'admin-login-div';
          adminDiv.innerHTML = `<h2>Admin Login 🗝️</h2><input type='password' id='admin-password' placeholder='Password...'><button id='admin-login-submit' class='cute-btn'>Unlock</button><p id='admin-login-error' class='error-msg hidden'></p>`;
          loginModal.querySelector('.modal-content').appendChild(adminDiv);
        }
        adminDiv.classList.remove('hidden');
        setTimeout(() => {
          const adminPassInput = document.getElementById('admin-password');
          if (adminPassInput) adminPassInput.focus();
        }, 50);
        document.getElementById('admin-login-submit').onclick = async () => {
          const pass = document.getElementById('admin-password').value;
          const hash = await sha256(pass);
          if (hash === adminHash) {
            isAdmin = true;
            isLoggedIn = true;
            currentUser = { name: 'Admin' };
            loginModal.classList.add('hidden');
            showProfileIcon(currentUser);
            adminDiv.classList.add('hidden');
            toggleAdminView();
          } else {
            document.getElementById('admin-login-error').textContent = 'Wrong password!';
            document.getElementById('admin-login-error').classList.remove('hidden');
          }
        };
      }
    }, 700);
  });
}

// Initialize the app
document.addEventListener('DOMContentLoaded', () => {
   init();
});