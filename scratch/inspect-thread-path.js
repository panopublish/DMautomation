const braveBrowserManager = require("../src/browser/brave-browser-manager");

async function main() {
  const page = await braveBrowserManager.getInstagramPage();
  const details = await page.evaluate(() => {
    // Find the text node "360 Trusted Virtual Tour"
    const all = Array.from(document.querySelectorAll("*"));
    const target = all.find(el => (el.innerText || "").trim() === "360 Trusted Virtual Tour");
    if (!target) return { found: false };

    // Traverse upwards to find the container
    let cur = target;
    const path = [];
    while (cur && cur !== document.body && path.length < 8) {
      path.push({
        tagName: cur.tagName,
        role: cur.getAttribute("role"),
        tabindex: cur.getAttribute("tabindex"),
        className: cur.className,
        text: (cur.innerText || "").slice(0, 80)
      });
      cur = cur.parentElement;
    }
    return { found: true, path };
  });

  console.log("Thread element path:", JSON.stringify(details, null, 2));
  process.exit(0);
}

main().catch(err => {
  console.error("Error:", err);
  process.exit(1);
});
