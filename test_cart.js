const puppeteer = require('puppeteer');

(async () => {
    const browser = await puppeteer.launch();
    const page = await browser.newPage();

    page.on('console', msg => console.log('PAGE LOG:', msg.text()));
    page.on('pageerror', err => console.log('PAGE ERROR:', err.toString()));

    await page.goto('http://localhost:8000/login', { waitUntil: 'networkidle0' });

    // Wait for React/Vanilla to render everything
    await page.waitForTimeout(1000);

    const cartItems = await page.evaluate(() => {
        return localStorage.getItem('tc_cart');
    });
    console.log('Cart Items on Boot:', cartItems);

    const modalDisplay = await page.evaluate(() => {
        return document.getElementById('auth-modal').style.display;
    });
    console.log('Auth Modal Display on Boot (/login):', modalDisplay);

    await browser.close();
})();
