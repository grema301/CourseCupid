const {Client} = require('pg')

const client = new Client({
    host: "isdb.uod.otago.ac.nz",
    user: "hogka652",
    port: 5432,
    password: "mee3jai4waed",
    database: "cosc345"
})

client.connect();

//node db/databasepg.js
client.query(`Select * from Web_User`, (err, res)=>{
    if(!err){
        console.log(res.rows);
    }else{
        console.log(err.message)
    }
    client.end;
})