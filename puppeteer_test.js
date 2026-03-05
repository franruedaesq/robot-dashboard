import puppeteer from 'puppeteer';

(async () => {
    console.log("Starting Puppeteer...");
    const browser = await puppeteer.launch({ headless: "new" });
    const page = await browser.newPage();

    page.on('console', msg => {
        const text = msg.text();
        if (text.includes('__crdt_wasm_active') || text.includes('js set_register ENTRY') || text.includes('js set_register EXIT') || text.includes('recursive use of an object')) {
            console.log(`[BROWSER] ${text}`);
        }
        if (text.includes('recursive use of an object detected')) {
            console.log("ERROR DETECTED! Exiting...");
            setTimeout(() => process.exit(0), 500);
        }
    });

    page.on('pageerror', err => {
        console.log(`[PAGE ERROR] ${err.message}`);
        if (err.message.includes('recursive use of an object detected')) {
            console.log("ERROR DETECTED! Exiting...");
            setTimeout(() => process.exit(0), 500);
        }
    });

    console.log("Navigating to http://localhost:5173/ ...");
    await page.goto('http://localhost:5173/');

    console.log("Wait for page to render...");
    await new Promise(r => setTimeout(r, 4000));

    console.log("Clicking Almacén scenario...");
    await page.evaluate(() => {
        const btns = Array.from(document.querySelectorAll('button'));
        const btn = btns.find(b => b.textContent && b.textContent.includes('Almacén'));
        if (btn) btn.click();
    });

    await new Promise(r => setTimeout(r, 3000));
    console.log("Checking if crashed...");
    const html = await page.content();
    if (html.includes('An error occurred in the')) {
        console.log("STILL CRASHED REACT TREE.");
    } else {
        console.log("NO CRASH DETECTED. Scenario changed successfully!");
    }

    await browser.close();
    process.exit(0);
})();
