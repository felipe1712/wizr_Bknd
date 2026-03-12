const { Client } = require('pg');
const fs = require('fs');

async function setupDatabase() {
  const client = new Client({
    user: 'postgres',
    password: '123',
    host: 'localhost',
    port: 5432,
    database: 'postgres'
  });

  try {
    await client.connect();
    console.log('Connected to template database.');

    const res = await client.query(`SELECT datname FROM pg_catalog.pg_database WHERE datname = 'wizr_db'`);
    if (res.rowCount === 0) {
      console.log('Creating database wizr_db...');
      await client.query('CREATE DATABASE wizr_db');
      console.log('wizr_db created successfully.');
    } else {
      console.log('wizr_db already exists.');
    }
  } catch (err) {
    console.error('Error creating database:', err);
    process.exit(1);
  } finally {
    await client.end();
  }

  const wizrClient = new Client({
    user: 'postgres',
    password: '123',
    host: 'localhost',
    port: 5432,
    database: 'wizr_db'
  });

  try {
    await wizrClient.connect();
    console.log('Connected to wizr_db. Running migrations...');

    const migrationsSql = fs.readFileSync('./merged_migrations.sql', 'utf8');
    
    await wizrClient.query(migrationsSql);
    console.log('Migrations executed successfully!');
  } catch (err) {
    console.error('Error running migrations:', err);
    process.exit(1);
  } finally {
    await wizrClient.end();
  }
}

setupDatabase();
