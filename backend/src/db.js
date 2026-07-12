const { Pool, Client } = require('pg');
require('dotenv').config();

const dbUser = process.env.DB_USER || 'postgres';
const dbHost = process.env.DB_HOST || 'localhost';
const dbPassword = process.env.DB_PASSWORD || 'postgres';
const dbPort = parseInt(process.env.DB_PORT || '5432');
const dbName = process.env.DB_DATABASE || 'fantasy_db';

// Configure connection options. Render/Neon usually supply DATABASE_URL and require SSL.
const poolConfig = process.env.DATABASE_URL
  ? {
      connectionString: process.env.DATABASE_URL,
      ssl: { rejectUnauthorized: false }
    }
  : {
      user: dbUser,
      host: dbHost,
      database: dbName,
      password: dbPassword,
      port: dbPort,
    };

// Primary application connection pool
const pool = new Pool(poolConfig);

// Helper query function
const query = (text, params) => pool.query(text, params);

// Auto-creates the database "fantasy_db" if it does not exist
async function ensureDatabaseExists() {
  if (process.env.DATABASE_URL) {
    // Skip database creation check when using a connection string on cloud services
    return;
  }
  const adminClient = new Client({
    user: dbUser,
    host: dbHost,
    password: dbPassword,
    port: dbPort,
    database: 'postgres', // Connect to default database
  });

  try {
    await adminClient.connect();
    // Check if database exists
    const checkQuery = 'SELECT 1 FROM pg_database WHERE datname = $1';
    const res = await adminClient.query(checkQuery, [dbName]);

    if (res.rows.length === 0) {
      console.log(`Banco de dados "${dbName}" não existe. Criando banco de dados...`);
      // CREATE DATABASE cannot be run with parameters or inside a transaction
      await adminClient.query(`CREATE DATABASE ${dbName}`);
      console.log(`Banco de dados "${dbName}" criado com sucesso!`);
    } else {
      console.log(`Banco de dados "${dbName}" já existe.`);
    }
  } catch (err) {
    console.error('Erro ao verificar/criar banco de dados principal:', err.message);
  } finally {
    try {
      await adminClient.end();
    } catch (e) {
      // Ignore cleanup error
    }
  }
}

// Database tables initialization and seeding
async function initDatabase() {
  // Ensure the DB exists before using the pool
  await ensureDatabaseExists();

  let client;
  try {
    // Connect pool to target database
    client = await pool.connect();
    console.log(`Conectado com sucesso ao banco de dados "${dbName}"`);
    
    // Create tables if they do not exist
    await client.query(`
      CREATE TABLE IF NOT EXISTS users (
        id SERIAL PRIMARY KEY,
        email VARCHAR(255) UNIQUE NOT NULL,
        password_hash VARCHAR(255) NOT NULL,
        is_admin BOOLEAN DEFAULT FALSE,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
      );

      CREATE TABLE IF NOT EXISTS sponsors (
        id SERIAL PRIMARY KEY,
        name VARCHAR(255) NOT NULL,
        logo_url TEXT,
        website_url TEXT,
        description TEXT,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
      );

      CREATE TABLE IF NOT EXISTS races (
        id SERIAL PRIMARY KEY,
        name VARCHAR(255) NOT NULL,
        description TEXT,
        year INT NOT NULL,
        start_date DATE,
        end_date DATE,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
      );

      CREATE TABLE IF NOT EXISTS athletes (
        id SERIAL PRIMARY KEY,
        race_id INT REFERENCES races(id) ON DELETE CASCADE,
        name VARCHAR(255) NOT NULL,
        nationality VARCHAR(100) NOT NULL,
        official_team VARCHAR(255) NOT NULL,
        value INT NOT NULL,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
      );

      CREATE TABLE IF NOT EXISTS user_teams (
        id SERIAL PRIMARY KEY,
        user_id INT REFERENCES users(id) ON DELETE CASCADE,
        race_id INT REFERENCES races(id) ON DELETE CASCADE,
        team_name VARCHAR(255) NOT NULL,
        sports_director VARCHAR(255) NOT NULL,
        jersey_icon VARCHAR(50) NOT NULL,
        country VARCHAR(100) NOT NULL,
        total_spent INT DEFAULT 0,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        CONSTRAINT unique_user_race_team UNIQUE (user_id, race_id)
      );

      CREATE TABLE IF NOT EXISTS team_athletes (
        user_team_id INT REFERENCES user_teams(id) ON DELETE CASCADE,
        athlete_id INT REFERENCES athletes(id) ON DELETE CASCADE,
        PRIMARY KEY (user_team_id, athlete_id)
      );

      ALTER TABLE user_teams ADD COLUMN IF NOT EXISTS points INT DEFAULT 0;
      ALTER TABLE races ADD COLUMN IF NOT EXISTS start_date DATE;
      ALTER TABLE races ADD COLUMN IF NOT EXISTS end_date DATE;

      CREATE TABLE IF NOT EXISTS leagues (
        id SERIAL PRIMARY KEY,
        name VARCHAR(255) NOT NULL,
        code VARCHAR(10) UNIQUE NOT NULL,
        creator_id INT REFERENCES users(id) ON DELETE CASCADE,
        race_id INT REFERENCES races(id) ON DELETE CASCADE,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
      );

      CREATE TABLE IF NOT EXISTS league_teams (
        league_id INT REFERENCES leagues(id) ON DELETE CASCADE,
        user_team_id INT REFERENCES user_teams(id) ON DELETE CASCADE,
        PRIMARY KEY (league_id, user_team_id)
      );

      CREATE TABLE IF NOT EXISTS race_stages (
        id SERIAL PRIMARY KEY,
        race_id INT REFERENCES races(id) ON DELETE CASCADE,
        stage_number INT NOT NULL,
        date DATE NOT NULL,
        start_location VARCHAR(255) NOT NULL,
        end_location VARCHAR(255) NOT NULL,
        distance_km DECIMAL(5,1) NOT NULL,
        profile_type VARCHAR(100) NOT NULL,
        image_url TEXT,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        CONSTRAINT unique_race_stage UNIQUE (race_id, stage_number)
      );
    `);
    
    // Set start and end dates for existing races that do not have them
    await client.query(`
      UPDATE races SET start_date = '2026-07-01', end_date = '2026-07-31' WHERE name = 'Tour de France' AND start_date IS NULL;
      UPDATE races SET start_date = '2026-05-01', end_date = '2026-05-31' WHERE name = 'Giro d''Italia' AND start_date IS NULL;
      UPDATE races SET start_date = '2026-08-15', end_date = '2026-09-15' WHERE name = 'Vuelta a España' AND start_date IS NULL;
      UPDATE races SET start_date = '2026-03-21', end_date = '2026-03-21' WHERE name = 'Milão-Sanremo' AND start_date IS NULL;
      UPDATE races SET start_date = '2026-04-05', end_date = '2026-04-05' WHERE name = 'Volta a Flandres' AND start_date IS NULL;
      UPDATE races SET start_date = '2026-04-12', end_date = '2026-04-12' WHERE name = 'Paris-Roubaix' AND start_date IS NULL;
      UPDATE races SET start_date = '2026-04-26', end_date = '2026-04-26' WHERE name = 'Liège-Bastogne-Liège' AND start_date IS NULL;
      UPDATE races SET start_date = '2026-10-10', end_date = '2026-10-10' WHERE name = 'Il Lombardia' AND start_date IS NULL;
      UPDATE races SET start_date = '2026-03-07', end_date = '2026-03-07' WHERE name = 'Strade Bianche' AND start_date IS NULL;
    `);

    console.log('Tabelas verificadas/criadas no banco de dados.');

    // Seed sponsors if empty
    const sponsorCheck = await client.query('SELECT COUNT(*) FROM sponsors');
    if (parseInt(sponsorCheck.rows[0].count) === 0) {
      console.log('Carregando patrocinadores iniciais...');
      await client.query(`
        INSERT INTO sponsors (name, logo_url, website_url, description) VALUES
        ('Visma | Lease a Bike', 'https://upload.wikimedia.org/wikipedia/commons/e/e8/Logo_Team_Visma_Lease_a_Bike.png', 'https://www.teamvismaleaseabike.com', 'Equipe profissional de ciclismo holandesa de nível UCI WorldTeam.'),
        ('INEOS Grenadiers', 'https://upload.wikimedia.org/wikipedia/commons/5/53/Ineos_grenadiers_logo.png', 'https://www.ineosgrenadiers.com', 'Equipe britânica de ciclismo de estrada profissional que compete no nível UCI WorldTeam.'),
        ('EF Education-EasyPost', 'https://upload.wikimedia.org/wikipedia/commons/e/ec/EF_Education-EasyPost_logo.png', 'https://www.efprocycling.com', 'Equipe americana com espírito inovador e cores vibrantes.'),
        ('Alpecin-Deceuninck', 'https://upload.wikimedia.org/wikipedia/commons/5/51/Alpecin-Deceuninck_logo.png', 'https://www.alpecin-deceuninck.com', 'Liderada pelo campeão mundial Mathieu van der Poel.');
      `);
    }

    // Seed races if empty (Grandes Voltas & Clássicas)
    const raceCheck = await client.query('SELECT COUNT(*) FROM races');
    if (parseInt(raceCheck.rows[0].count) < 9) {
      console.log('Carregando Grandes Voltas e Clássicas de Ciclismo...');
      await client.query('TRUNCATE TABLE team_athletes, user_teams, athletes, races RESTART IDENTITY CASCADE');
      const raceInsertResult = await client.query(`
        INSERT INTO races (name, description, year, start_date, end_date) VALUES
        ('Tour de France', 'A maior e mais prestigiosa corrida de ciclismo do mundo (Grande Volta).', 2026, '2026-07-01', '2026-07-31'),
        ('Giro d''Italia', 'A charmosa corrida pelas estradas e montanhas italianas (Grande Volta).', 2026, '2026-05-01', '2026-05-31'),
        ('Vuelta a España', 'A emocionante volta espanhola que fecha a temporada de Grand Tours (Grande Volta).', 2026, '2026-08-15', '2026-09-15'),
        ('Milão-Sanremo', 'A clássica dos velocistas, a mais longa corrida de um dia do calendário.', 2026, '2026-03-21', '2026-03-21'),
        ('Volta a Flandres', 'Clássica dos paralelepípedos na Bélgica com subidas curtas e íngremes (Muro de Grammont).', 2026, '2026-04-05', '2026-04-05'),
        ('Paris-Roubaix', 'O Inferno do Norte, famosa por seus severos setores de paralelepípedos.', 2026, '2026-04-12', '2026-04-12'),
        ('Liège-Bastogne-Liège', 'A Doyenne (A Mais Velha), clássica montanhosa nas Ardenas belgas.', 2026, '2026-04-26', '2026-04-26'),
        ('Il Lombardia', 'A clássica das folhas mortas, monumento que fecha a temporada de outono.', 2026, '2026-10-10', '2026-10-10'),
        ('Strade Bianche', 'A corrida pelas estradas brancas de terra batida da Toscana.', 2026, '2026-03-07', '2026-03-07')
        RETURNING id, name;
      `);

      const racesMap = {};
      raceInsertResult.rows.forEach(r => {
        racesMap[r.name] = r.id;
      });

      console.log('Carregando atletas oficiais do mercado de transferências...');
      
      // 1. Tour de France
      const tdfId = racesMap['Tour de France'];
      const fs = require('fs');
      const path = require('path');
      const tdfRidersPath = path.join(__dirname, '..', 'tdf_riders.json');
      
      if (fs.existsSync(tdfRidersPath)) {
        console.log('Carregando atletas oficiais do Tour de France a partir de tdf_riders.json...');
        const tdfRiders = JSON.parse(fs.readFileSync(tdfRidersPath, 'utf8'));
        for (const rider of tdfRiders) {
          const escName = rider.name.replace(/'/g, "''");
          const escNat = rider.nationality.replace(/'/g, "''");
          const escTeam = rider.official_team.replace(/'/g, "''");
          await client.query(`
            INSERT INTO athletes (race_id, name, nationality, official_team, value)
            VALUES (${tdfId}, '${escName}', '${escNat}', '${escTeam}', ${rider.value})
          `);
        }
        console.log(`Carregados ${tdfRiders.length} atletas do Tour de France no banco de dados!`);
      } else {
        console.log('tdf_riders.json não encontrado. Usando lista reduzida de atletas...');
        await client.query(`
          INSERT INTO athletes (race_id, name, nationality, official_team, value) VALUES
          (${tdfId}, 'Tadej Pogačar', 'Eslovênia', 'UAE Team Emirates', 450),
          (${tdfId}, 'Jonas Vingegaard', 'Dinamarca', 'Team Visma | Lease a Bike', 420),
          (${tdfId}, 'Remco Evenepoel', 'Bélgica', 'Soudal Quick-Step', 380),
          (${tdfId}, 'Primož Roglič', 'Eslovênia', 'Red Bull-BORA-hansgrohe', 350),
          (${tdfId}, 'Matteo Jorgenson', 'EUA', 'Team Visma | Lease a Bike', 200),
          (${tdfId}, 'João Almeida', 'Portugal', 'UAE Team Emirates', 220),
          (${tdfId}, 'Carlos Rodríguez', 'Espanha', 'INEOS Grenadiers', 240),
          (${tdfId}, 'Mikel Landa', 'Espanha', 'Soudal Quick-Step', 180),
          (${tdfId}, 'Richard Carapaz', 'Equador', 'EF Education-EasyPost', 250),
          (${tdfId}, 'Biniam Girmay', 'Eritreia', 'Intermarché - Wanty', 160),
          (${tdfId}, 'Jasper Philipsen', 'Bélgica', 'Alpecin-Deceuninck', 200),
          (${tdfId}, 'Derek Gee', 'Canadá', 'Israel - Premier Tech', 150);
        `);
      }

      // 2. Giro d'Italia
      const giroId = racesMap['Giro d\'Italia'];
      await client.query(`
        INSERT INTO athletes (race_id, name, nationality, official_team, value) VALUES
        (${giroId}, 'Daniel Martínez', 'Colômbia', 'Red Bull-BORA-hansgrohe', 300),
        (${giroId}, 'Geraint Thomas', 'Reino Unido', 'INEOS Grenadiers', 280),
        (${giroId}, 'Antonio Tiberi', 'Itália', 'Bahrain Victorious', 220),
        (${giroId}, 'Ben O''Connor', 'Austrália', 'Decathlon AG2R La Mondiale', 260),
        (${giroId}, 'Cian Uijtdebroeks', 'Bélgica', 'Team Visma | Lease a Bike', 180),
        (${giroId}, 'Jonathan Milan', 'Itália', 'Lidl-Trek', 210),
        (${giroId}, 'Julian Alaphilippe', 'França', 'Soudal Quick-Step', 190),
        (${giroId}, 'Romain Bardet', 'França', 'Team dsm-firmenich PostNL', 200);
      `);

      // 3. Vuelta a España
      const vuId = racesMap['Vuelta a España'];
      await client.query(`
        INSERT INTO athletes (race_id, name, nationality, official_team, value) VALUES
        (${vuId}, 'Sepp Kuss', 'EUA', 'Team Visma | Lease a Bike', 280),
        (${vuId}, 'Enric Mas', 'Espanha', 'Movistar Team', 260),
        (${vuId}, 'Alexander Vlasov', 'Rússia', 'Red Bull-BORA-hansgrohe', 240),
        (${vuId}, 'Wout van Aert', 'Bélgica', 'Team Visma | Lease a Bike', 250),
        (${vuId}, 'Brandon McNulty', 'EUA', 'UAE Team Emirates', 190),
        (${vuId}, 'Adam Yates', 'Reino Unido', 'UAE Team Emirates', 250),
        (${vuId}, 'Kaden Groves', 'Austrália', 'Alpecin-Deceuninck', 180),
        (${vuId}, 'Marc Soler', 'Espanha', 'UAE Team Emirates', 150);
      `);

      // 4. Clássicas dos paralelepípedos (Flandres / Paris-Roubaix)
      const fldId = racesMap['Volta a Flandres'];
      const rbxId = racesMap['Paris-Roubaix'];
      
      const cobbledStars = [
        ['Mathieu van der Poel', 'Holanda', 'Alpecin-Deceuninck', 450],
        ['Wout van Aert', 'Bélgica', 'Team Visma | Lease a Bike', 420],
        ['Mads Pedersen', 'Dinamarca', 'Lidl-Trek', 380],
        ['Jasper Philipsen', 'Bélgica', 'Alpecin-Deceuninck', 300],
        ['Biniam Girmay', 'Eritreia', 'Intermarché - Wanty', 250],
        ['Stefan Küng', 'Suíça', 'Groupama-FDJ', 200],
        ['Nils Politt', 'Alemanha', 'UAE Team Emirates', 180],
        ['Matteo Trentin', 'Itália', 'Tudor Pro Cycling', 160]
      ];

      for (const [name, nat, team, val] of cobbledStars) {
        await client.query(`INSERT INTO athletes (race_id, name, nationality, official_team, value) VALUES (${fldId}, '${name}', '${nat}', '${team}', ${val})`);
        await client.query(`INSERT INTO athletes (race_id, name, nationality, official_team, value) VALUES (${rbxId}, '${name}', '${nat}', '${team}', ${val})`);
      }

      // 5. Clássicas de Subidas / Ardenas e Estrada de Terra (Liège / Lombardia / Strade Bianche / Sanremo)
      const lgeId = racesMap['Liège-Bastogne-Liège'];
      const lmbId = racesMap['Il Lombardia'];
      const stbId = racesMap['Strade Bianche'];
      const msrId = racesMap['Milão-Sanremo'];

      const hillyStars = [
        ['Tadej Pogačar', 'Eslovênia', 'UAE Team Emirates', 450],
        ['Remco Evenepoel', 'Bélgica', 'Soudal Quick-Step', 400],
        ['Tom Pidcock', 'Reino Unido', 'INEOS Grenadiers', 320],
        ['Marc Hirschi', 'Suíça', 'UAE Team Emirates', 260],
        ['Maxim Van Gils', 'Bélgica', 'Lotto Dstny', 220],
        ['Ben Healy', 'Irlanda', 'EF Education-EasyPost', 240],
        ['Benoit Cosnefroy', 'França', 'Decathlon AG2R La Mondiale', 190],
        ['Richard Carapaz', 'Equador', 'EF Education-EasyPost', 280]
      ];

      for (const [name, nat, team, val] of hillyStars) {
        await client.query(`INSERT INTO athletes (race_id, name, nationality, official_team, value) VALUES (${lgeId}, '${name}', '${nat}', '${team}', ${val})`);
        await client.query(`INSERT INTO athletes (race_id, name, nationality, official_team, value) VALUES (${lmbId}, '${name}', '${nat}', '${team}', ${val})`);
        await client.query(`INSERT INTO athletes (race_id, name, nationality, official_team, value) VALUES (${stbId}, '${name}', '${nat}', '${team}', ${val})`);
        await client.query(`INSERT INTO athletes (race_id, name, nationality, official_team, value) VALUES (${msrId}, '${name}', '${nat}', '${team}', ${val})`);
      }
      
      // Seed stages for Tour de France 2026 if empty
      const stagesCheck = await client.query('SELECT COUNT(*) FROM race_stages WHERE race_id = $1', [tdfId]);
      if (parseInt(stagesCheck.rows[0].count) === 0) {
        console.log('Semeando 21 etapas do Tour de France 2026...');
        const tdfStages = [
          { num: 1, start: 'Barcelona', end: 'Barcelona', dist: 19.0, type: 'Contra-relógio Equipes (TTT)', date: '2026-07-04' },
          { num: 2, start: 'Barcelona', end: 'Girona', dist: 175.0, type: 'Média Montanha', date: '2026-07-05' },
          { num: 3, start: 'Girona', end: 'Tarragona', dist: 165.0, type: 'Plano', date: '2026-07-06' },
          { num: 4, start: 'Tarragona', end: 'Zaragoza', dist: 180.0, type: 'Plano', date: '2026-07-07' },
          { num: 5, start: 'Zaragoza', end: 'Pau', dist: 210.0, type: 'Alta Montanha', date: '2026-07-08' },
          { num: 6, start: 'Pau', end: 'Gavarnie-Gèdre', dist: 145.0, type: 'Alta Montanha', date: '2026-07-09' },
          { num: 7, start: 'Tarbes', end: 'Montauban', dist: 160.0, type: 'Plano', date: '2026-07-10' },
          { num: 8, start: 'Montauban', end: 'Figeac', dist: 170.0, type: 'Média Montanha', date: '2026-07-11' },
          { num: 9, start: 'Figeac', end: 'Clermont-Ferrand', dist: 190.0, type: 'Média Montanha', date: '2026-07-12' },
          { num: 10, start: 'Clermont-Ferrand', end: 'Orléans', dist: 185.0, type: 'Plano', date: '2026-07-13' },
          { num: 11, start: 'Orléans', end: 'Nevers', dist: 155.0, type: 'Plano', date: '2026-07-14' },
          { num: 12, start: 'Nevers', end: 'Lyon', dist: 195.0, type: 'Plano', date: '2026-07-15' },
          { num: 13, start: 'Lyon', end: 'Grand Colombier', dist: 150.0, type: 'Alta Montanha', date: '2026-07-16' },
          { num: 14, start: 'Saint-Jean-de-Maurienne', end: 'Alpe d\'Huez', dist: 120.0, type: 'Alta Montanha', date: '2026-07-17' },
          { num: 15, start: 'Briançon', end: 'Orcières-Merlette', dist: 165.0, type: 'Alta Montanha', date: '2026-07-18' },
          { num: 16, start: 'Évian-les-Bains', end: 'Thonon-les-Bains', dist: 26.0, type: 'Contra-relógio (ITT)', date: '2026-07-19' },
          { num: 17, start: 'Albertville', end: 'Plateau de Solaison', dist: 140.0, type: 'Alta Montanha', date: '2026-07-20' },
          { num: 18, start: 'Morzine', end: 'Genebra', dist: 130.0, type: 'Média Montanha', date: '2026-07-21' },
          { num: 19, start: 'Bourg-en-Bresse', end: 'Dijon', dist: 175.0, type: 'Plano', date: '2026-07-22' },
          { num: 20, start: 'Dijon', end: 'Troyes', dist: 160.0, type: 'Plano', date: '2026-07-23' },
          { num: 21, start: 'Rambouillet', end: 'Paris (Champs-Élysées)', dist: 110.0, type: 'Plano', date: '2026-07-24' }
        ];

        for (const stage of tdfStages) {
          const escStart = stage.start.replace(/'/g, "''");
          const escEnd = stage.end.replace(/'/g, "''");
          await client.query(`
            INSERT INTO race_stages (race_id, stage_number, date, start_location, end_location, distance_km, profile_type, image_url)
            VALUES ($1, $2, $3, $4, $5, $6, $7, $8)
          `, [tdfId, stage.num, stage.date, escStart, escEnd, stage.dist, stage.type, '/cycling_stage_profile.png']);
        }
        console.log('Etapas do Tour de France semeadas com sucesso!');
      }
      
      console.log('Carregamento inicial de dados concluído com sucesso!');
    }

    // Default admin seeding check
    const adminCheck = await client.query("SELECT COUNT(*) FROM users WHERE email = 'admin@fantasy.com'");
    let adminUserId;
    const bcrypt = require('bcryptjs');
    if (parseInt(adminCheck.rows[0].count) === 0) {
      console.log('Cadastrando usuário admin padrão...');
      const adminPassHash = await bcrypt.hash('admin123', 10);
      const insertAdmin = await client.query(`
        INSERT INTO users (email, password_hash, is_admin)
        VALUES ('admin@fantasy.com', '${adminPassHash}', TRUE)
        RETURNING id
      `);
      adminUserId = insertAdmin.rows[0].id;
      console.log('Admin padrão cadastrado com sucesso (admin@fantasy.com / admin123)');
    } else {
      const getAdmin = await client.query("SELECT id FROM users WHERE email = 'admin@fantasy.com'");
      adminUserId = getAdmin.rows[0].id;
    }

    // Seed mock users, teams, and points for Tour de France 2026 (race_id = 1) if they do not exist
    const mockUsersCount = await client.query("SELECT COUNT(*) FROM users WHERE email IN ('joao@fantasy.com', 'maria@fantasy.com', 'pedro@fantasy.com')");
    if (parseInt(mockUsersCount.rows[0].count) === 0) {
      console.log('Semeando usuários, equipes e pontuações fictícias para o ranking de ligas...');
      const mockPassHash = await bcrypt.hash('user123', 10);
      
      const mockUsers = [
        { email: 'joao@fantasy.com', name: 'João Silva', team: 'Velozes e Furiosos', director: 'João Silva', country: 'Portugal', jersey: 'jersey-red', points: 720 },
        { email: 'maria@fantasy.com', name: 'Maria Souza', team: 'Pedal de Ouro', director: 'Maria Souza', country: 'Brasil', jersey: 'jersey-yellow', points: 850 },
        { email: 'pedro@fantasy.com', name: 'Pedro Santos', team: 'Caravela do Asfalto', director: 'Pedro Santos', country: 'Portugal', jersey: 'jersey-blue', points: 590 }
      ];

      // Get Tour de France race ID and 8 athlete IDs to link to all mock teams
      const tdfRes = await client.query("SELECT id FROM races WHERE name = 'Tour de France'");
      const tdfId = tdfRes.rows[0].id;
      const athletesRes = await client.query('SELECT id FROM athletes WHERE race_id = $1 LIMIT 8', [tdfId]);
      const athleteIds = athletesRes.rows.map(r => r.id);

      // Also create a team for the admin user
      const adminTeamCheck = await client.query('SELECT COUNT(*) FROM user_teams WHERE user_id = $1 AND race_id = $2', [adminUserId, tdfId]);
      if (parseInt(adminTeamCheck.rows[0].count) === 0 && athleteIds.length === 8) {
        const teamRes = await client.query(`
          INSERT INTO user_teams (user_id, race_id, team_name, sports_director, jersey_icon, country, total_spent, points)
          VALUES ($1, $2, 'Equipe do Diretor', 'Administrador', 'jersey-rainbow', 'Brasil', 980, 680)
          RETURNING id
        `, [adminUserId, tdfId]);
        
        for (const athId of athleteIds) {
          await client.query('INSERT INTO team_athletes (user_team_id, athlete_id) VALUES ($1, $2)', [teamRes.rows[0].id, athId]);
        }
      }

      for (const u of mockUsers) {
        const userRes = await client.query(`
          INSERT INTO users (email, password_hash, is_admin)
          VALUES ($1, $2, FALSE)
          RETURNING id
        `, [u.email, mockPassHash]);
        const userId = userRes.rows[0].id;

        if (athleteIds.length === 8) {
          const teamRes = await client.query(`
            INSERT INTO user_teams (user_id, race_id, team_name, sports_director, jersey_icon, country, total_spent, points)
            VALUES ($1, $2, $3, $4, $5, $6, 950, $7)
            RETURNING id
          `, [userId, tdfId, u.team, u.director, u.jersey, u.country, u.points]);
          
          for (const athId of athleteIds) {
            await client.query('INSERT INTO team_athletes (user_team_id, athlete_id) VALUES ($1, $2)', [teamRes.rows[0].id, athId]);
          }
        }
      }
      console.log('Usuários, equipes e pontuações semeadas com sucesso!');
    }

  } catch (err) {
    console.error('Erro na inicialização/semeadura do banco:', err.message);
  } finally {
    if (client) client.release();
  }
}

module.exports = {
  query,
  pool,
  initDatabase
};
