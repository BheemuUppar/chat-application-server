const { Client } = require('pg')
const client = new Client({
  user: 'postgres',
  host: 'localhost',
  database: 'postgres',
  password: 'admin',
  port: 5432,
})
client.connect(function(err) {
  if (err) throw err;
  console.log("pl/sql DB Connected!");
});

module.exports = client;