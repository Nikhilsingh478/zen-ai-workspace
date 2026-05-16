const fs = require('fs');
const content = fs.readFileSync('dist/assets/index-CVM9C0-v.js', 'utf8');

console.log("Includes sb_publishable:", content.includes('sb_publishable_NpWyQLF8ULpqmJcNxrU75Q_YqND_8xl'));
console.log("Includes dummy.supabase.co:", content.includes('dummy.supabase.co'));
console.log("Includes AIzaSy:", content.includes('AIzaSyDtaTnhMqC0J9JS7VYez7IrZVu4opcJ40E'));
