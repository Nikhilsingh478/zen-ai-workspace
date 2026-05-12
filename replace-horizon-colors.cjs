const fs = require("fs");
const path = require("path");

const files = [
  "src/routes/horizon.tsx"
].map(p => path.join(__dirname, p));

files.forEach(file => {
  let content = fs.readFileSync(file, "utf8");

  content = content.replace(/rgba\(0,\s*191,\s*255/g, "rgba(220,76,100");
  content = content.replace(/#00BFFF/gi, "#DC4C64");
  content = content.replace(/#4DEBFF/gi, "#E05A6F");

  fs.writeFileSync(file, content, "utf8");
});

console.log("Horizon updated to Crimson theme successfully.");
