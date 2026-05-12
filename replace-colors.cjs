const fs = require("fs");
const path = require("path");

const files = [
  "src/routes/jarvis.tsx",
  "src/components/jarvis/floating-orb.tsx",
  "src/components/jarvis/ai-core.tsx"
].map(p => path.join(__dirname, p));

files.forEach(file => {
  let content = fs.readFileSync(file, "utf8");

  // rgba(0,191,255, alpha) -> rgba(220,76,100, alpha)
  content = content.replace(/rgba\(0,\s*191,\s*255/g, "rgba(220,76,100");
  
  // #00BFFF -> #DC4C64
  content = content.replace(/#00BFFF/gi, "#DC4C64");
  
  // #4DEBFF -> #E05A6F
  content = content.replace(/#4DEBFF/gi, "#E05A6F");
  
  // #7EEEFF -> #F28D9E
  content = content.replace(/#7EEEFF/gi, "#F28D9E");
  
  // #00263F -> #531A24
  content = content.replace(/#00263F/gi, "#531A24");
  
  // rgba(0,40,70, alpha) -> rgba(83,26,36, alpha)
  content = content.replace(/rgba\(0,\s*40,\s*70/g, "rgba(83,26,36");
  
  // ai-core.tsx colors:
  // const C0 = "#0EA5E9"; // sky-500 -> #DC4C64
  // const C1 = "#38BDF8"; // sky-400 -> #E05A6F
  // const C2 = "#BAE6FD"; // sky-200 -> #F28D9E
  content = content.replace(/"#0EA5E9"/gi, '"#DC4C64"');
  content = content.replace(/"#38BDF8"/gi, '"#E05A6F"');
  content = content.replace(/"#BAE6FD"/gi, '"#F28D9E"');

  // Also in jarvis.tsx: "rgba(180,230,255,0.9)" -> "rgba(255,180,200,0.9)"
  content = content.replace(/rgba\(180,\s*230,\s*255/g, "rgba(255,180,200");
  // "rgba(220,240,255,0.82)" -> "rgba(255,220,230,0.82)"
  content = content.replace(/rgba\(220,\s*240,\s*255/g, "rgba(255,220,230");

  fs.writeFileSync(file, content, "utf8");
});

console.log("Colors updated to Crimson theme successfully.");
