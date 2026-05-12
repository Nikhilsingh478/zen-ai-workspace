const fs = require("fs");
const path = require("path");

const files = [
  "src/routes/jarvis.tsx",
  "src/components/jarvis/floating-orb.tsx",
  "src/components/jarvis/ai-core.tsx",
  "src/routes/horizon.tsx",
].map(p => path.join(__dirname, p));

files.forEach(file => {
  if (!fs.existsSync(file)) return;
  
  let content = fs.readFileSync(file, "utf8");

  // rgba(220,76,100, alpha) -> rgba(125,211,252, alpha)
  content = content.replace(/rgba\(220,\s*76,\s*100/g, "rgba(125,211,252");
  
  // #DC4C64 -> #7DD3FC
  content = content.replace(/#DC4C64/gi, "#7DD3FC");
  
  // #E05A6F -> #93C5FD
  content = content.replace(/#E05A6F/gi, "#93C5FD");
  
  // #F28D9E -> #BAE6FD
  content = content.replace(/#F28D9E/gi, "#BAE6FD");
  
  // #531A24 -> #121826
  content = content.replace(/#531A24/gi, "#121826");
  
  // rgba(83,26,36, alpha) -> rgba(18,24,38, alpha)
  content = content.replace(/rgba\(83,\s*26,\s*36/g, "rgba(18,24,38");
  
  // rgba(255,180,200, alpha) -> rgba(186,230,253, alpha)
  content = content.replace(/rgba\(255,\s*180,\s*200/g, "rgba(186,230,253");
  
  // rgba(255,220,230, alpha) -> rgba(243,247,250, alpha)
  content = content.replace(/rgba\(255,\s*220,\s*230/g, "rgba(243,247,250");

  fs.writeFileSync(file, content, "utf8");
});

console.log("Colors successfully reverted and mapped to Arctic Glass Theme.");
