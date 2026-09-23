const braveBrowserManager = require("../src/browser/brave-browser-manager");

async function main() {
  const page = await braveBrowserManager.getInstagramPage();
  const convs = await page.evaluate(() => {
    // Look at all elements in the inbox left pane
    const elements = Array.from(document.querySelectorAll('div, a, span'));
    const matches = [];
    for (const el of elements) {
      const text = (el.innerText || "").trim();
      if (text.includes("360 Trusted Virtual Tour")) {
        const link = el.closest("a") || el.querySelector("a");
        matches.push({
          tagName: el.tagName,
          className: el.className,
          text: text.slice(0, 100),
          href: link ? link.href : null,
          role: el.getAttribute("role")
        });
      }
    }
    return matches.slice(0, 5);
  });
  console.log("Matches:", JSON.stringify(convs, null, 2));
  process.exit(0);
}

main().catch(err => {
  console.error("Error:", err);
  process.exit(1);
});
