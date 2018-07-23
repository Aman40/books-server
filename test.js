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
let man = new Manager(5);
for(let i=0;i<5;i++) {
	let sql = `INSERT INTO test VALUES ('${i}', '${names[i]}')`;
	console.log(`Running ${i}`);
	con.query(sql, (err, result)=>{
		console.log(`${i} finished.`);
		if(err) {
			console.log("It failed with: "+JSON.stringify(err));
			man.failed();
		} else {
			console.log("It succeeded with: "+JSON.stringify(result));
			man.succeeded();
		}
	});
}

function Manager(total){
	this.counter = {
		total: total,
		completed: 0,
		succeeded: 0,
		failed: 0,
	};
	this.succeeded = ()=>{
		this.counter.succeeded++;
		this.counter.completed++;
		this.finishIfWeAreDone();
	};
	this.failed = ()=>{
		this.counter.failed++;
		this.counter.completed++;
		this.finishIfWeAreDone();
	};
	this.weAreDone = ()=>{
		return this.counter.total === this.counter.completed;
	};
	this.finishIfWeAreDone = ()=>{
		if(this.weAreDone()){
			console.log("We are done");
			console.log(JSON.stringify(this.counter));
		}
	};
}
