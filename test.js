#!/local/bin/node
/**
 * The point of this is to test whether multiple asynchronous mysql requests can be
 * made in parallel and whether they indeed run in parallel or are internally 
 * serialized by the mysql module. Order matters. Who finishes first. And the result.
 * Does it succeed or does it fail with an error? I could read the documentation,
 * but that's for the weak. I'd prefer trial by combat.
 */
const mysql = require("mysql");
let con = mysql.createConnection({
	host: "localhost",
	database: "test",
	user: "aman",
	password: "password"
});
//Define the query
let names = ["Aman", "Meishen", "Rajesh", "Haytham", "Hani", "Anna", "Shaothing", "Lira"];
for(let i=0;i<5;i++) {
	let sql = `INSERT INTO test VALUES ('${i}', '${names[i]}')`;
	console.log(`Running ${i}`);
	con.query(sql, (err, result)=>{
		console.log(`${i} finished.`);
		if(err) {
			console.log("It failed with: "+JSON.stringify(err));
		} else {
			console.log("It succeeded with: "+JSON.stringify(result));
		}
	});
}

function Manager(){
    
}