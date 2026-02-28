const puppeteer = require('puppeteer');

(async () => {
    const browser = await puppeteer.launch({ args: ['--no-sandbox', '--disable-setuid-sandbox'] });
    const page = await browser.newPage();

    // Inject mock logged-in state before navigating to bypass manual login
    await page.evaluateOnNewDocument(() => {
        localStorage.setItem('tc_user', JSON.stringify({
            id: "buyer123",
            name: "buyer123",
            mobile: "123",
            address: "123"
        }));
    });

    page.on('console', msg => console.log('PAGE LOG:', msg.text()));
    page.on('pageerror', err => console.log('PAGE ERROR:', err.toString()));
    page.on('response', resp => {
        if (!resp.ok() && resp.url().includes('assets')) {
            console.log('FAILED REQUEST:', resp.url(), resp.status());
        }
    });

    console.log("Navigating to /login...");
    await page.goto('http://localhost:8000/login', { waitUntil: 'networkidle0' });

    await page.waitForTimeout(2000);

    const images = await page.evaluate(() => {
        return Array.from(document.querySelectorAll('.product-img')).map(el => el.src || el.innerText);
    });
    console.log('Rendered Images:', images);

    const currentUrl = await page.evaluate(() => window.location.href);
    console.log('Final URL after redirect:', currentUrl);

    const baseHref = await page.evaluate(() => document.querySelector('base') ? document.querySelector('base').href : 'MISING BASE TAG');
    console.log('Base Href Tag:', baseHref);

    await browser.close();
})();
