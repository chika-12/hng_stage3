const dns = require('dns');
dns.setDefaultResultOrder('ipv4first');
dns.setServers(['8.8.8.8', '8.8.4.4']); // force Google DNS

const env = require('dotenv');
env.config({ path: './config.env' });
const app = require('./app');
const mongoose = require('mongoose');
const redis = require('./utils/redisClient');
const port = process.env.PORT || 3000;
const DB = process.env.DATABASE.replace('<PASSWORD>', process.env.PASSWORD);

mongoose
  .connect(DB, {maxPoolSize: 20,
    minPoolSize: 5,   readPreference: 'secondaryPreferred'
})
  .then(() => {
    console.log('Database connected');
    app.listen(port, () => {
      console.log(`Server running on port ${port}`);
    });
  })
  .catch((err) => {
    console.log('Connection failed', err);
  });


redis.set('test', 'Redis is working')
  .then(() => redis.get('test'))
  .then((val) => console.log('Redis test:', val))
  .catch((err) => console.log('Redis error:', err));