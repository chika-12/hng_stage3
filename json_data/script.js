const dns = require('dns');
dns.setDefaultResultOrder('ipv4first');
dns.setServers(['8.8.8.8', '8.8.4.4']); // force Google DNS

const mongoose = require('mongoose');
const fs = require('fs');
const path = require('path');
const { v7: uuidv7 } = require('uuid');
const Profile = require('../models/usermodel');
const env = require('dotenv');
env.config({ path: '../config.env' });

const seedDB = async () => {
  try {
    await mongoose.connect(
      process.env.DATABASE.replace('<PASSWORD>', process.env.PASSWORD)
    );
    console.log('Connected to MongoDB');

    const filePath = path.join(__dirname, 'seed_profiles.json');
    const raw = fs.readFileSync(filePath, 'utf-8');
    const { profiles } = JSON.parse(raw);

    // Attach a UUID v7 id to each record
    const prepared = profiles.map((profile) => ({
      ...profile,
      id: uuidv7(),
    }));

    await Profile.deleteMany({});
    console.log('Existing records cleared');

    const inserted = await Profile.insertMany(prepared);
    console.log(`Seeded ${inserted.length} records successfully`);
  } catch (err) {
    console.error('Seeding failed:', err.message);
  } finally {
    await mongoose.disconnect();
    console.log('Disconnected');
  }
};

seedDB();
