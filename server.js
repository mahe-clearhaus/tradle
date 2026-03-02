/**
 * SRS file server — reads and writes srs-progress.txt.
 * Runs alongside the React dev server on port 3001.
 * The React app proxies /api/* to this server (see "proxy" in package.json).
 */

const http = require("http");
const fs = require("fs");
const path = require("path");

const FILE = path.join(__dirname, "srs-progress.txt");
const PORT = 3001;

const CORS = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "GET, POST, OPTIONS",
  "Access-Control-Allow-Headers": "Content-Type",
};

http
  .createServer((req, res) => {
    Object.entries(CORS).forEach(([k, v]) => res.setHeader(k, v));

    if (req.method === "OPTIONS") {
      res.writeHead(200);
      res.end();
      return;
    }

    if (req.method === "GET" && req.url === "/api/srs") {
      const data = fs.existsSync(FILE) ? fs.readFileSync(FILE, "utf8") : "";
      res.writeHead(200, { "Content-Type": "text/plain" });
      res.end(data);
      return;
    }

    if (req.method === "POST" && req.url === "/api/srs") {
      let body = "";
      req.on("data", (chunk) => (body += chunk));
      req.on("end", () => {
        fs.writeFileSync(FILE, body, "utf8");
        res.writeHead(200);
        res.end();
      });
      return;
    }

    res.writeHead(404);
    res.end();
  })
  .listen(PORT, () =>
    console.log(`[SRS] File server on port ${PORT}  →  ${FILE}`)
  );
