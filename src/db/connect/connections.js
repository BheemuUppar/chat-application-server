const { Client } = require('pg');
const { connectionString } = require('pg/lib/defaults');
const client = new Client({
  connectionString:process.env.dbURI
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