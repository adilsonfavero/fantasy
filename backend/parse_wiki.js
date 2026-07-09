const fs = require('fs');
const path = require('path');

const WIKI_FILE_PATH = path.join(__dirname, 'wiki_tdf.html');

const countryTranslation = {
  Slovenia: 'Eslovênia',
  Denmark: 'Dinamarca',
  Belgium: 'Bélgica',
  Spain: 'Espanha',
  France: 'França',
  'Great Britain': 'Reino Unido',
  'United Kingdom': 'Reino Unido',
  Italy: 'Itália',
  Colombia: 'Colômbia',
  Australia: 'Austrália',
  Canada: 'Canadá',
  Portugal: 'Portugal',
  Netherlands: 'Holanda',
  Ecuador: 'Equador',
  Eritrea: 'Eritreia',
  Germany: 'Alemanha',
  Switzerland: 'Suíça',
  Austria: 'Áustria',
  Norway: 'Noruega',
  Ireland: 'Irlanda',
  'New Zealand': 'Nova Zelândia',
  'South Africa': 'África do Sul',
  Poland: 'Polônia',
  'Czech Republic': 'República Tcheca',
  Luxembourg: 'Luxemburgo',
  Latvia: 'Letônia',
  Kazakhstan: 'Cazaquistão',
  Estonia: 'Estônia',
  Hungary: 'Hungria',
  Russia: 'Rússia',
  'United States': 'EUA',
  USA: 'EUA',
  Ukraine: 'Ucrânia'
};

function translateCountry(c) {
  if (!c) return 'Outro';
  const trimmed = c.trim();
  return countryTranslation[trimmed] || trimmed;
}

function generateRiderValue(name) {
  const normalized = name.toLowerCase();
  
  if (normalized.includes('pogačar') || normalized.includes('pogacar')) return 450;
  if (normalized.includes('vingegaard')) return 420;
  if (normalized.includes('evenepoel')) return 400;
  if (normalized.includes('roglič') || normalized.includes('roglic')) return 350;
  if (normalized.includes('van der poel')) return 380;
  if (normalized.includes('van aert')) return 340;
  if (normalized.includes('pedersen') && normalized.includes('mads')) return 320;
  if (normalized.includes('philipsen')) return 300;
  if (normalized.includes('almeida') && normalized.includes('joão')) return 260;
  if (normalized.includes('yates') && (normalized.includes('adam') || normalized.includes('simon'))) return 250;
  if (normalized.includes('rodríguez') && normalized.includes('carlos')) return 240;
  if (normalized.includes('carapaz')) return 250;
  if (normalized.includes('kuss') && normalized.includes('sepp')) return 260;
  if (normalized.includes('girmay')) return 220;
  if (normalized.includes('jorgenson')) return 240;
  if (normalized.includes('gee') && normalized.includes('derek')) return 180;
  if (normalized.includes('thomas') && normalized.includes('geraint')) return 220;
  if (normalized.includes('hinault') || normalized.includes('bardet') || normalized.includes('gaudu')) return 210;
  if (normalized.includes('bilbao') || normalized.includes('landa')) return 200;
  
  let hash = 0;
  for (let i = 0; i < name.length; i++) {
    hash = name.charCodeAt(i) + ((hash << 5) - hash);
  }
  const min = 100;
  const max = 220;
  const range = max - min;
  const cost = min + (Math.abs(hash) % Math.round(range / 10)) * 10;
  return cost;
}

function parse() {
  const content = fs.readFileSync(WIKI_FILE_PATH, 'utf-8');
  
  // Find the table starting from "By starting number" header
  const sectionSplit = content.split('id="By_starting_number"');
  if (sectionSplit.length < 2) {
    console.error('Could not find starting number section in HTML');
    return;
  }
  
  const rest = sectionSplit[1];
  const rows = rest.split('<tr');
  const riders = [];
  
  console.log(`Total raw table rows found: ${rows.length}`);
  
  // We process up to 185 rows (as verified from diagnostic output)
  // Row 1 is header, Row 2 to 185 are the 184 riders.
  for (let i = 2; i <= 185; i++) {
    if (i >= rows.length) break;
    const row = rows[i];
    
    // 1. Rider Name (inside <th>)
    // Match any link that goes to a /wiki/ path inside the <th>
    const riderMatch = row.match(/<th[^>]*>.*?<a[^>]*href="[^"]*\/wiki\/[^"]+"[^>]*>([^<]+)<\/a>/s);
    if (!riderMatch) continue;
    const name = riderMatch[1].trim();
    
    // Split the row into <td> elements to extract cells
    const cells = row.split(/<td[^>]*>/);
    if (cells.length < 4) continue;
    
    // Cell index 2: Nationality
    const nationCell = cells[2];
    const nationMatch = nationCell.match(/<a[^>]*href="[^"]*\/wiki\/[^"]+"[^>]*>([^<]+)<\/a>/);
    const nationality = nationMatch ? translateCountry(nationMatch[1]) : 'Outro';
    
    // Cell index 3: Team
    const teamCell = cells[3];
    const teamMatch = teamCell.match(/<a[^>]*href="[^"]*\/wiki\/[^"]+"[^>]*>([^<]+)<\/a>/);
    const official_team = teamMatch ? teamMatch[1].trim() : 'Outro';
    
    riders.push({
      name,
      nationality,
      official_team,
      value: generateRiderValue(name)
    });
  }
  
  console.log(`Successfully parsed ${riders.length} riders!`);
  
  if (riders.length > 0) {
    const outputPath = path.join(__dirname, 'tdf_riders.json');
    fs.writeFileSync(outputPath, JSON.stringify(riders, null, 2));
    console.log(`Saved riders database to ${outputPath}`);
  } else {
    console.log('No riders found, check parsing logic.');
  }
}

parse();
