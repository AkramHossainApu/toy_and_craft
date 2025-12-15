const adminHash = 'f18852e91292d79d72697f658b2d66116764860719e58f7626f28c2766f5f75d';

// Firebase config and init
const firebaseConfig = {
    apiKey: "AIzaSyARQW48lm5jEavNwCDG7tKlolxJPg1ggLg",
    authDomain: "toyandcraftstore.firebaseapp.com",
    projectId: "toyandcraftstore",
    storageBucket: "toyandcraftstore.firebasestorage.app",
    messagingSenderId: "732577086084",
    appId: "1:732577086084:web:9f5db5dce1491124aaa0d1"
};
firebase.initializeApp(firebaseConfig);
const db = firebase.firestore();

// Data generated from file system
const defaultProducts = [
  {
    "id": "bounce tiger",
    "name": "Bounce Tiger",
    "image": "assets/images/bounce tiger.jpg",
    "stock": 10
  },
  {
    "id": "cinderella",
    "name": "Cinderella",
    "image": "assets/images/cinderella.jpg",
    "stock": 10
  },
  {
    "id": "crab boss",
    "name": "Crab Boss",
    "image": "assets/images/crab boss.jpg",
    "stock": 10
  },
  {
    "id": "culomi",
    "name": "Culomi",
    "image": "assets/images/culomi.jpg",
    "stock": 10
  },
  {
    "id": "daffy bear",
    "name": "Daffy Bear",
    "image": "assets/images/daffy bear.jpg",
    "stock": 10
  },
  {
    "id": "daisy",
    "name": "Daisy",
    "image": "assets/images/daisy.jpg",
    "stock": 10
  },
  {
    "id": "donald duck",
    "name": "Donald Duck",
    "image": "assets/images/donald duck.jpg",
    "stock": 10
  },
  {
    "id": "F3022",
    "name": "F3022",
    "image": "assets/images/F3022.jpg",
    "stock": 10
  },
  {
    "id": "F3023",
    "name": "F3023",
    "image": "assets/images/F3023.jpg",
    "stock": 10
  },
  {
    "id": "F3024",
    "name": "F3024",
    "image": "assets/images/F3024.jpg",
    "stock": 10
  },
  {
    "id": "F3027",
    "name": "F3027",
    "image": "assets/images/F3027.jpg",
    "stock": 10
  },
  {
    "id": "F3028",
    "name": "F3028",
    "image": "assets/images/F3028.jpg",
    "stock": 10
  },
  {
    "id": "F3031",
    "name": "F3031",
    "image": "assets/images/F3031.jpg",
    "stock": 10
  },
  {
    "id": "F3033",
    "name": "F3033",
    "image": "assets/images/F3033.jpg",
    "stock": 10
  },
  {
    "id": "F3034",
    "name": "F3034",
    "image": "assets/images/F3034.jpg",
    "stock": 10
  },
  {
    "id": "F3035",
    "name": "F3035",
    "image": "assets/images/F3035.jpg",
    "stock": 10
  },
  {
    "id": "F3039",
    "name": "F3039",
    "image": "assets/images/F3039.jpg",
    "stock": 10
  },
  {
    "id": "F3041",
    "name": "F3041",
    "image": "assets/images/F3041.jpg",
    "stock": 10
  },
  {
    "id": "F3045",
    "name": "F3045",
    "image": "assets/images/F3045.jpg",
    "stock": 10
  },
  {
    "id": "F3046",
    "name": "F3046",
    "image": "assets/images/F3046.jpg",
    "stock": 10
  },
  {
    "id": "flower cat",
    "name": "Flower Cat",
    "image": "assets/images/flower cat.jpg",
    "stock": 10
  },
  {
    "id": "H09",
    "name": "H09",
    "image": "assets/images/H09.jpg",
    "stock": 10
  },
  {
    "id": "H17",
    "name": "H17",
    "image": "assets/images/H17.jpg",
    "stock": 10
  },
  {
    "id": "hello kitty",
    "name": "Hello Kitty",
    "image": "assets/images/hello kitty.jpg",
    "stock": 10
  },
  {
    "id": "Hibiscus flower 260-29",
    "name": "Hibiscus Flower 260 29",
    "image": "assets/images/Hibiscus flower 260-29.jpg",
    "stock": 10
  },
  {
    "id": "jera cat",
    "name": "Jera Cat",
    "image": "assets/images/jera cat.jpg",
    "stock": 10
  },
  {
    "id": "keqian",
    "name": "Keqian",
    "image": "assets/images/keqian.jpg",
    "stock": 10
  },
  {
    "id": "Mandala flower 260-31",
    "name": "Mandala Flower 260 31",
    "image": "assets/images/Mandala flower 260-31.jpg",
    "stock": 10
  },
  {
    "id": "mary red",
    "name": "Mary Red",
    "image": "assets/images/mary red.jpg",
    "stock": 10
  },
  {
    "id": "meile rabbit",
    "name": "Meile Rabbit",
    "image": "assets/images/meile rabbit.jpg",
    "stock": 10
  },
  {
    "id": "nabell",
    "name": "Nabell",
    "image": "assets/images/nabell.jpg",
    "stock": 10
  },
  {
    "id": "nick",
    "name": "Nick",
    "image": "assets/images/nick.jpg",
    "stock": 10
  },
  {
    "id": "pacha dog",
    "name": "Pacha Dog",
    "image": "assets/images/pacha dog.jpg",
    "stock": 10
  },
  {
    "id": "pie star",
    "name": "Pie Star",
    "image": "assets/images/pie star.jpg",
    "stock": 10
  },
  {
    "id": "pikachu",
    "name": "Pikachu",
    "image": "assets/images/pikachu.jpg",
    "stock": 10
  },
  {
    "id": "Q5044",
    "name": "Q5044",
    "image": "assets/images/Q5044.jpg",
    "stock": 10
  },
  {
    "id": "Q5045",
    "name": "Q5045",
    "image": "assets/images/Q5045.jpg",
    "stock": 10
  },
  {
    "id": "Q5046",
    "name": "Q5046",
    "image": "assets/images/Q5046.jpg",
    "stock": 10
  },
  {
    "id": "Q5047",
    "name": "Q5047",
    "image": "assets/images/Q5047.jpg",
    "stock": 10
  },
  {
    "id": "Q5048",
    "name": "Q5048",
    "image": "assets/images/Q5048.jpg",
    "stock": 10
  },
  {
    "id": "Q5051",
    "name": "Q5051",
    "image": "assets/images/Q5051.jpg",
    "stock": 10
  },
  {
    "id": "Q5053",
    "name": "Q5053",
    "image": "assets/images/Q5053.jpg",
    "stock": 10
  },
  {
    "id": "Q5054",
    "name": "Q5054",
    "image": "assets/images/Q5054.jpg",
    "stock": 10
  },
  {
    "id": "qiqi mouse",
    "name": "Qiqi Mouse",
    "image": "assets/images/qiqi mouse.jpg",
    "stock": 10
  },
  {
    "id": "Red panda - drinking coconut juice",
    "name": "Red Panda   Drinking Coconut Juice",
    "image": "assets/images/Red panda - drinking coconut juice.jpg",
    "stock": 10
  },
  {
    "id": "Red panda - eat bamboo",
    "name": "Red Panda   Eat Bamboo",
    "image": "assets/images/Red panda - eat bamboo.jpg",
    "stock": 10
  },
  {
    "id": "Red panda - eat watermelon",
    "name": "Red Panda   Eat Watermelon",
    "image": "assets/images/Red panda - eat watermelon.jpg",
    "stock": 10
  },
  {
    "id": "Red panda - eating cake",
    "name": "Red Panda   Eating Cake",
    "image": "assets/images/Red panda - eating cake.jpg",
    "stock": 10
  },
  {
    "id": "Red panda - eating pumpkin",
    "name": "Red Panda   Eating Pumpkin",
    "image": "assets/images/Red panda - eating pumpkin.jpg",
    "stock": 10
  },
  {
    "id": "Red panda - grass sliding board",
    "name": "Red Panda   Grass Sliding Board",
    "image": "assets/images/Red panda - grass sliding board.jpg",
    "stock": 10
  },
  {
    "id": "Red panda - holding apple",
    "name": "Red Panda   Holding Apple",
    "image": "assets/images/Red panda - holding apple.jpg",
    "stock": 10
  },
  {
    "id": "Red panda - rocking chair",
    "name": "Red Panda   Rocking Chair",
    "image": "assets/images/Red panda - rocking chair.jpg",
    "stock": 10
  },
  {
    "id": "Red panda - scooter",
    "name": "Red Panda   Scooter",
    "image": "assets/images/Red panda - scooter.jpg",
    "stock": 10
  },
  {
    "id": "Red panda - sunshine bath",
    "name": "Red Panda   Sunshine Bath",
    "image": "assets/images/Red panda - sunshine bath.jpg",
    "stock": 10
  },
  {
    "id": "Red panda - swimming ring",
    "name": "Red Panda   Swimming Ring",
    "image": "assets/images/Red panda - swimming ring.jpg",
    "stock": 10
  },
  {
    "id": "Red panda - wooden climbing pile",
    "name": "Red Panda   Wooden Climbing Pile",
    "image": "assets/images/Red panda - wooden climbing pile.jpg",
    "stock": 10
  },
  {
    "id": "shirley rose",
    "name": "Shirley Rose",
    "image": "assets/images/shirley rose.jpg",
    "stock": 10
  },
  {
    "id": "single crystal pink rose",
    "name": "Single Crystal Pink Rose",
    "image": "assets/images/single crystal pink rose.jpg",
    "stock": 10
  },
  {
    "id": "single crystal red rose",
    "name": "Single Crystal Red Rose",
    "image": "assets/images/single crystal red rose.jpg",
    "stock": 10
  },
  {
    "id": "Single Pink Rose-Double Form",
    "name": "Single Pink Rose Double Form",
    "image": "assets/images/Single Pink Rose-Double Form.jpg",
    "stock": 10
  },
  {
    "id": "Single Red Rose-Double Form",
    "name": "Single Red Rose Double Form",
    "image": "assets/images/Single Red Rose-Double Form.jpg",
    "stock": 10
  },
  {
    "id": "small sponge",
    "name": "Small Sponge",
    "image": "assets/images/small sponge.jpg",
    "stock": 10
  },
  {
    "id": "snow white",
    "name": "Snow White",
    "image": "assets/images/snow white.jpg",
    "stock": 10
  },
  {
    "id": "squidward",
    "name": "Squidward",
    "image": "assets/images/squidward.jpg",
    "stock": 10
  },
  {
    "id": "star dailu",
    "name": "Star Dailu",
    "image": "assets/images/star dailu.jpg",
    "stock": 10
  },
  {
    "id": "stitch",
    "name": "Stitch",
    "image": "assets/images/stitch.jpg",
    "stock": 10
  },
  {
    "id": "three eyes",
    "name": "Three Eyes",
    "image": "assets/images/three eyes.jpg",
    "stock": 10
  },
  {
    "id": "Tulip 260-28",
    "name": "Tulip 260 28",
    "image": "assets/images/Tulip 260-28.jpg",
    "stock": 10
  },
  {
    "id": "W1522-02 calico cat",
    "name": "W1522 02 Calico Cat",
    "image": "assets/images/W1522-02 calico cat.jpg",
    "stock": 10
  },
  {
    "id": "W1523-02 british short blue cat",
    "name": "W1523 02 British Short Blue Cat",
    "image": "assets/images/W1523-02 british short blue cat.jpg",
    "stock": 10
  },
  {
    "id": "W1523-03 british short blue and white",
    "name": "W1523 03 British Short Blue And White",
    "image": "assets/images/W1523-03 british short blue and white.jpg",
    "stock": 10
  },
  {
    "id": "W1523-05 cow cat",
    "name": "W1523 05 Cow Cat",
    "image": "assets/images/W1523-05 cow cat.jpg",
    "stock": 10
  },
  {
    "id": "W1526-01 papillon",
    "name": "W1526 01 Papillon",
    "image": "assets/images/W1526-01 papillon.jpg",
    "stock": 10
  },
  {
    "id": "W1526-04 doberman pinscher",
    "name": "W1526 04 Doberman Pinscher",
    "image": "assets/images/W1526-04 doberman pinscher.jpg",
    "stock": 10
  },
  {
    "id": "W1526-05 pastoral dog brown",
    "name": "W1526 05 Pastoral Dog Brown",
    "image": "assets/images/W1526-05 pastoral dog brown.jpg",
    "stock": 10
  },
  {
    "id": "W1527-05 shiba inu",
    "name": "W1527 05 Shiba Inu",
    "image": "assets/images/W1527-05 shiba inu.jpg",
    "stock": 10
  },
  {
    "id": "W1528-01 short-haired soil pine",
    "name": "W1528 01 Short Haired Soil Pine",
    "image": "assets/images/W1528-01 short-haired soil pine.jpg",
    "stock": 10
  },
  {
    "id": "W1528-02 five red dogs",
    "name": "W1528 02 Five Red Dogs",
    "image": "assets/images/W1528-02 five red dogs.jpg",
    "stock": 10
  },
  {
    "id": "W1528-03 four eyebrow dog",
    "name": "W1528 03 Four Eyebrow Dog",
    "image": "assets/images/W1528-03 four eyebrow dog.jpg",
    "stock": 10
  },
  {
    "id": "W1528-04 chaozhou dog",
    "name": "W1528 04 Chaozhou Dog",
    "image": "assets/images/W1528-04 chaozhou dog.jpg",
    "stock": 10
  },
  {
    "id": "White lily 260-24",
    "name": "White Lily 260 24",
    "image": "assets/images/White lily 260-24.jpg",
    "stock": 10
  }
].map(p => ({ ...p, price: p.price !== undefined ? p.price : 10.00 }));

// App State
let inventory = [];
let isLoggedIn = false;
let editingProductId = null;

// DOM Elements
const grid = document.getElementById('product-grid');
const adminLoginBtn = document.getElementById('admin-login-btn');
const adminPanel = document.getElementById('admin-panel');
const logoutBtn = document.getElementById('logout-btn');

const loginModal = document.getElementById('login-modal');
const editModal = document.getElementById('edit-modal');
const closeModals = document.querySelectorAll('.close-modal');

const passwordInput = document.getElementById('password-input');
const loginSubmit = document.getElementById('login-submit');
const loginError = document.getElementById('login-error');

const editName = document.getElementById('edit-product-name');
const editImage = document.getElementById('edit-product-image');
const stockInput = document.getElementById('stock-input');
const priceInput = document.getElementById('price-input');
const saveStockBtn = document.getElementById('save-stock-btn');

// DOM refs for new controls
const searchInput = document.getElementById('search-input');
const sortSelect = document.getElementById('sort-select');

// --- Initialization ---

function init() {
    loadInventory();
    renderProducts();
    setupEventListeners();
}

async function loadInventory() {
    try {
        const snapshot = await db.collection('products').get();
        if (snapshot.empty) {
            await Promise.all(defaultProducts.map(p => db.collection('products').doc(p.id).set(p)));
            inventory = JSON.parse(JSON.stringify(defaultProducts));
        } else {
            inventory = snapshot.docs.map(doc => doc.data());
        }
        renderProducts();
    } catch (e) {
        const saved = localStorage.getItem('toyStoreInventory');
        if (saved) {
            inventory = JSON.parse(saved);
        } else {
            inventory = JSON.parse(JSON.stringify(defaultProducts));
        }
        renderProducts();
    }
}

async function saveInventory() {
    await Promise.all(inventory.map(p => db.collection('products').doc(p.id).set(p)));
    localStorage.setItem('toyStoreInventory', JSON.stringify(inventory));
}

// --- Rendering ---

function renderProducts() {
    grid.innerHTML = '';
    let filtered = inventory.slice();
    const searchVal = searchInput ? searchInput.value.trim().toLowerCase() : '';
    if (searchVal) {
        filtered = filtered.filter(p => p.name.toLowerCase().includes(searchVal));
    }
    const sortVal = sortSelect ? sortSelect.value : 'default';
    if (sortVal === "price-asc") {
        filtered.sort((a, b) => (a.price || 0) - (b.price || 0));
    } else if (sortVal === "price-desc") {
        filtered.sort((a, b) => (b.price || 0) - (a.price || 0));
    } else if (sortVal === "stock") {
        filtered = filtered.filter(p => p.stock > 0);
    } else if (sortVal === "out") {
        filtered = filtered.filter(p => p.stock === 0);
    }
    filtered.forEach(product => {
        const card = document.createElement('div');
        card.className = 'card';
        let stockClass = 'stock-high';
        let stockText = `In Stock: ${product.stock}`;
        if (product.stock === 0) {
            stockClass = 'stock-out';
            stockText = 'Out of Stock';
        } else if (product.stock < 3) {
            stockClass = 'stock-low';
            stockText = `Low Stock: ${product.stock}`;
        }
        const editDisplay = isLoggedIn ? 'block' : 'none';
        card.innerHTML = `
            <div class="card-img-container">
                <img src="${product.image}" alt="${product.name}" class="card-img" loading="lazy">
            </div>
            <div class="card-title">${product.name}</div>
            <div class="price-tag">$${(product.price || 0).toFixed(2)}</div>
            <div class="stock-status ${stockClass}">${stockText}</div>
            <button class="edit-btn" style="display: ${editDisplay}" onclick="openEditModal('${product.id}')">Update Stock ✏️</button>
        `;
        grid.appendChild(card);
    });
}

function toggleAdminView() {
    if (isLoggedIn) {
        adminLoginBtn.classList.add('hidden');
        adminPanel.classList.remove('hidden');
    } else {
        adminLoginBtn.classList.remove('hidden');
        adminPanel.classList.add('hidden');
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
            passwordInput.value = '';
        });
    });

    window.addEventListener('click', (e) => {
        if (e.target === loginModal) {
            loginModal.classList.add('hidden');
            loginError.classList.add('hidden');
            passwordInput.value = '';
        }
        if (e.target === editModal) editModal.classList.add('hidden');
    });

    // Login
    adminLoginBtn.addEventListener('click', () => {
        loginModal.classList.remove('hidden');
    });

    loginSubmit.addEventListener('click', handleLogin);

    passwordInput.addEventListener('keypress', (e) => {
        if (e.key === 'Enter') handleLogin();
    });

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
    const password = passwordInput.value;
    const hash = await sha256(password);

    if (hash === adminHash) {
        isLoggedIn = true;
        loginModal.classList.add('hidden');
        passwordInput.value = '';
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
    stockInput.value = product.stock;
    if (priceInput) priceInput.value = product.price || 0;

    editModal.classList.remove('hidden');
}

async function handleSaveStock() {
    const newStock = parseInt(stockInput.value);
    const newPrice = parseFloat(priceInput.value);
    if (isNaN(newStock) || newStock < 0) {
        alert("Please enter a valid stock number.");
        return;
    }
    if (isNaN(newPrice) || newPrice < 0) {
        alert("Please enter a valid price.");
        return;
    }
    const product = inventory.find(p => p.id === editingProductId);
    if (product) {
        product.stock = newStock;
        product.price = newPrice;
        await saveInventory();
        renderProducts();
        editModal.classList.add('hidden');
    }
}

// Start the app
init();
