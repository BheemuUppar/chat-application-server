const { Client } = require('pg');
const { connectionString } = require('pg/lib/defaults');
const client = new Client({
  connectionString:"postgresql://chat-application_owner:2jR7UDrgMGtv@ep-bitter-bonus-a5bdozgu.us-east-2.aws.neon.tech/chat-application?sslmode=require&options=--timezone=Asia/Kolkata"
})
client.connect(function(err) {
try {
  if (err) throw err;
  console.log("pl/sql DB Connected!");
  keepDBActive()
} catch (error) {
  console.log("DB connection closed...")
}
});

 function keepDBActive(){
 setInterval(async()=>{
  let query = 'select * from dummytable;'
  await client.query(query);
  console.log('keeping alive..')
 }, (4 * 60 * 1000))
}

module.exports = client;