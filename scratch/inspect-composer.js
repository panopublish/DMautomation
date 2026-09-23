const braveBrowserManager = require("../src/browser/brave-browser-manager");

async function main() {
  const page = await braveBrowserManager.getInstagramPage();
  const composer = await page.evaluate(() => {
    const editables = Array.from(document.querySelectorAll('[contenteditable="true"], textarea, p[dir="ltr"]'));
    return editables.map(el => ({
      tagName: el.tagName,
      role: el.getAttribute("role"),
      ariaLabel: el.getAttribute("aria-label"),
      className: el.className,
      placeholder: el.getAttribute("placeholder") || el.getAttribute("data-placeholder") || ""
    }));
  });

  console.log("Composer elements found:", JSON.stringify(composer, null, 2));
  process.exit(0);
}

main().catch(err => {
  console.error("Error:", err);
  process.exit(1);
});
