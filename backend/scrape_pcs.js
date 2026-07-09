const https = require('https');
const fs = require('fs');
const path = require('path');

const URL = 'https://www.procyclingstats.com/race/tour-de-france/2026/startlist';

function fetchPage(url) {
  return new Promise((resolve, reject) => {
    const options = {
      headers: {
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36'
      }
    };
    https.get(url, options, (res) => {
      if (res.statusCode !== 200) {
        reject(new Error(`Failed to fetch page: Status Code ${res.statusCode}`));
        return;
      }
      let html = '';
      res.on('data', chunk => html += chunk);
      res.on('end', () => resolve(html));
    }).on('error', reject);
  });
}

// Map country codes to Portuguese country names
const nationalityMap = {
  sl: 'Eslovênia',
  dk: 'Dinamarca',
  be: 'Bélgica',
  es: 'Espanha',
  us: 'EUA',
  fr: 'França',
  gb: 'Reino Unido',
  it: 'Itália',
  co: 'Colômbia',
  au: 'Austrália',
  ca: 'Canadá',
  pt: 'Portugal',
  nl: 'Holanda',
  ec: 'Equador',
  er: 'Eritreia',
  de: 'Alemanha',
  ch: 'Suíça',
  at: 'Áustria',
  no: 'Noruega',
  ie: 'Irlanda',
  nz: 'Nova Zelândia',
  za: 'África do Sul',
  pl: 'Polônia',
  cz: 'República Tcheca',
  lu: 'Luxemburgo',
  lv: 'Letônia',
  kaz: 'Cazaquistão',
  ee: 'Estônia',
  hu: 'Hungria',
  ru: 'Rússia',
  us: 'EUA',
  ua: 'Ucrânia'
};

function getNationality(flagClass) {
  if (!flagClass) return 'Outro';
  const code = flagClass.toLowerCase().trim();
  return nationalityMap[code] || code.toUpperCase();
}

// Parse PCS startlist HTML
function parsePCSStartlist(html) {
  const riders = [];
  
  // Regex to match team block and the list of riders inside
  // Teams are usually structured as: <li class="team"><b><a href="team/...">Team Name</a></b>
  // Followed by list items containing: <a class="rider" href="rider/...">Rider Name</a> and <span class="flag [flagClass]"></span>
  
  // Let's do a line-by-line or block-by-block parsing
  // Find all matches for teams
  const teamBlocks = html.split('<li class="team">');
  
  console.log(`Found ${teamBlocks.length - 1} team blocks in HTML.`);
  
  // Skip the first split element as it's the header before any team block
  for (let i = 1; i < teamBlocks.length; i++) {
    const block = teamBlocks[i];
    
    // Extract team name
    const teamNameMatch = block.match(/<b><a href="team\/[^"]+">([^<]+)<\/a><\/b>/);
    if (!teamNameMatch) continue;
    const teamName = teamNameMatch[1].trim();
    
    // Find all riders in this team block
    // Each rider has a line like: <div>... <a href="rider/...">Rider Name</a> ... <span class="flag [flagClass]"></span> or similar
    // Let's match all <a> tags that have a rider href: href="rider/([^"]+)"
    // And flag spans: class="flag ([a-z]+)" or flag-([a-z]+)
    
    // Split the block by <li> to get each rider's line
    const riderLines = block.split('<li>');
    for (let j = 1; j < riderLines.length; j++) {
      const line = riderLines[j];
      
      // Stop if we exit the current team list (end of <ul>)
      if (line.includes('</ul>')) {
        // Only process elements before </ul> if there is one
      }
      
      const riderNameMatch = line.match(/<a href="rider\/[^"]+">([^<]+)<\/a>/);
      const flagMatch = line.match(/<span class="flag\s+([a-z0-9_-]+)"/);
      
      if (riderNameMatch) {
        const name = riderNameMatch[1].trim();
        const flagClass = flagMatch ? flagMatch[1] : '';
        const nationality = getNationality(flagClass);
        
        riders.push({
          name,
          nationality,
          official_team: teamName,
          // Generate a value between 100 and 450
          value: generateRiderValue(name)
        });
      }
    }
  }
  
  return riders;
}

// Generate a random-like value based on the rider's name/prestige
// We pre-set high values for superstars, and range others from 100 to 280
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
  
  // Default distribution
  // Let's use a hash of the name to keep the value consistent between runs
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

async function run() {
  try {
    console.log(`Fetching Tour de France startlist from ProCyclingStats...`);
    let html;
    try {
      html = await fetchPage(URL);
    } catch (e) {
      console.log('Error fetching 2026 page, trying 2025 startlist fallback...');
      const fallbackUrl = 'https://www.procyclingstats.com/race/tour-de-france/2025/startlist';
      html = await fetchPage(fallbackUrl);
    }
    
    console.log(`HTML downloaded. Parsing riders...`);
    const riders = parsePCSStartlist(html);
    
    console.log(`Successfully parsed ${riders.length} riders from PCS!`);
    
    const outputPath = path.join(__dirname, 'tdf_riders.json');
    fs.writeFileSync(outputPath, JSON.stringify(riders, null, 2));
    console.log(`Riders list saved to ${outputPath}`);
  } catch (err) {
    console.error('Scraping failed:', err.message);
  }
}

run();
