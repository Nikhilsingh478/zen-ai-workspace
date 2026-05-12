const fs = require("fs");
const path = require("path");

const files = [
  "src/routes/horizon.tsx",
  "src/routes/context.tsx",
  "src/components/jarvis/ai-core.tsx",
  "src/components/app-shell.tsx"
].map(p => path.join(__dirname, p));

files.forEach(file => {
  if (!fs.existsSync(file)) return;
  
  let content = fs.readFileSync(file, "utf8");

  // rgba(14,165,233, alpha) -> rgba(125,211,252, alpha) [Sky 500 to Arctic Primary]
  content = content.replace(/rgba\(14,\s*165,\s*233/g, "rgba(125,211,252");
  
  // rgba(56,189,248, alpha) -> rgba(147,197,253, alpha) [Sky 400 to Arctic Soft]
  content = content.replace(/rgba\(56,\s*189,\s*248/g, "rgba(147,197,253");
  
  // rgba(2,132,199, alpha) -> rgba(186,230,253, alpha) [Sky 600 to Ice Blue]
  content = content.replace(/rgba\(2,\s*132,\s*199/g, "rgba(186,230,253");
  
  // #0369A1 -> #0A0F1A
  content = content.replace(/#0369A1/gi, "#0A0F1A");

  fs.writeFileSync(file, content, "utf8");
});

console.log("Remaining Sky Blue traces successfully cleaned and mapped to Arctic Glass Theme.");
