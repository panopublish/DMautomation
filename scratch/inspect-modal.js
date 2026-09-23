const braveBrowserManager = require("../src/browser/brave-browser-manager");

async function main() {
  const page = await braveBrowserManager.getInstagramPage();

  const modalDetails = await page.evaluate(() => {
    // Find dialog / modal
    const modal = document.querySelector('div[role="dialog"]');
    if (!modal) return { hasDialog: false };

    const checkboxes = Array.from(modal.querySelectorAll('input[type="checkbox"], div[role="button"]')).map(el => ({
      tag: el.tagName,
      role: el.getAttribute("role"),
      text: (el.innerText || "").slice(0, 50)
    }));

    const buttons = Array.from(modal.querySelectorAll('button, div[role="button"]')).map(el => (el.innerText || "").trim()).filter(Boolean);

    return {
      hasDialog: true,
      text: modal.innerText.slice(0, 300),
      buttons,
      checkboxes
    };
  });

  console.log("Modal Details:", JSON.stringify(modalDetails, null, 2));
  process.exit(0);
}

main().catch(err => {
  console.error("Error:", err);
  process.exit(1);
});
