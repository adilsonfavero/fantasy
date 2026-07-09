const fs = require('fs');
const path = require('path');

const contentPath = 'C:\\Users\\adils\\Workspace\\Fantasy\\backend\\wiki_tdf.html';
const content = fs.readFileSync(contentPath, 'utf-8');

const index = content.indexOf('id="By_starting_number"');
if (index === -1) {
  console.log('Not found');
  process.exit(1);
}

const rest = content.substring(index);
const rows = rest.split('<tr');
console.log('Total split rows after header in full file:', rows.length);

// Print index 175-185 to verify we have the full list
for (let i = 175; i < Math.min(190, rows.length); i++) {
  console.log(`--- ROW ${i} ---`);
  console.log(rows[i].substring(0, 150));
}
