const { Client } = require('pg');
const { connectionString } = require('pg/lib/defaults');
const client = new Client({
  connectionString:"postgresql://chat-application_owner:2jR7UDrgMGtv@ep-bitter-bonus-a5bdozgu.us-east-2.aws.neon.tech/chat-application?sslmode=require"
})
client.connect(function(err) {
  if (err) throw err;
  console.log("pl/sql DB Connected!");
});

module.exports = client;