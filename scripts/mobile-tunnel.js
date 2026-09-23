/**
 * scripts/mobile-tunnel.js
 * Automatically starts the PanoPublish Dashboard and opens a secure public HTTPS tunnel
 * for mobile access from anywhere (Wi-Fi, 4G, 5G).
 */

const { spawn } = require("child_process");
const http = require("http");
const os = require("os");
const path = require("path");

const PORT = process.env.PORT || 3000;

function getLocalIp() {
  const nets = os.networkInterfaces();
  for (const name of Object.keys(nets)) {
    for (const net of nets[name]) {
      if (net.family === "IPv4" && !net.internal && !net.address.startsWith("192.168.56.")) {
        return net.address;
      }
    }
  }
  return "localhost";
}

function checkPortOpen(port) {
  return new Promise((resolve) => {
    const req = http.get(`http://localhost:${port}/api/stats`, () => {
      resolve(true);
    });
    req.on("error", () => resolve(false));
    req.setTimeout(1000, () => {
      req.destroy();
      resolve(false);
    });
  });
}

async function main() {
  console.log("\n============================================================");
  console.log("       PANOPUBLISH DASHBOARD — MOBILE HOSTING SETUP        ");
  console.log("============================================================");

  const localIp = getLocalIp();
  console.log(`\n[1] LOCAL WI-FI ACCESS:`);
  console.log(`    Connect your phone to the same Wi-Fi and open:`);
  console.log(`    👉  http://${localIp}:${PORT}\n`);

  const isAlreadyRunning = await checkPortOpen(PORT);
  if (!isAlreadyRunning) {
    console.log(`[2] Starting local dashboard server on port ${PORT}...`);
    const serverPath = path.resolve(__dirname, "../src/server/dashboard-server.js");
    const srv = spawn("node", [serverPath], { stdio: "inherit", shell: true });
    
    srv.on("error", (err) => {
      console.error("Failed to start dashboard server:", err.message);
    });
    
    // Give it a moment to boot
    await new Promise((r) => setTimeout(r, 1500));
  } else {
    console.log(`[2] Dashboard server is already running on port ${PORT}.`);
  }

  console.log(`\n[3] CREATING SECURE PUBLIC HTTPS TUNNEL (For 4G/5G / Anywhere Access)...`);
  console.log(`    Starting localtunnel via npx...\n`);

  const lt = spawn("npx", ["-y", "localtunnel", "--port", PORT.toString()], {
    shell: true
  });

  lt.stdout.on("data", (data) => {
    const msg = data.toString();
    console.log(msg.trim());
    if (msg.includes("your url is:")) {
      const match = msg.match(/https:\/\/[^\s]+/);
      if (match) {
        console.log("\n============================================================");
        console.log("🎉 YOUR MOBILE DASHBOARD IS LIVE ON THE WEB!");
        console.log("============================================================");
        console.log(`📱 Public Mobile URL : ${match[0]}`);
        console.log(`📶 Local Wi-Fi URL   : http://${localIp}:${PORT}`);
        console.log("============================================================");
        console.log("💡 Tip: On the localtunnel splash screen, click 'Click to Continue' or enter your public IP.\n");
      }
    }
  });

  lt.stderr.on("data", (data) => {
    const errStr = data.toString();
    if (!errStr.includes("DeprecationWarning")) {
      console.error(errStr.trim());
    }
  });

  lt.on("close", (code) => {
    console.log(`Tunnel closed (code ${code}).`);
  });
}

main().catch(console.error);
