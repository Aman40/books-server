#!/usr/bin/node
const express = require("express");
const app = express();
const books = require("./mod_books");
const login = require("./mod_loginout");
const signup = require("./mod_signup");
const session = require("express-session");
const MySqlStore = require("express-mysql-session");
const mysql = require("mysql");

/*Connection options for the session store. I'm using my already existing mysql "books"
* database for sessions. The same database holds all app info. Oops! I said too much!*/
const store_options = {
	host: "localhost",
	port: 3306,
	user: "aman",
	password: "password",
	database: "books",
};
let sessionStore = new MySqlStore(store_options);

const session_options = {
	cookie: {
		path: "/",
		httpOnly: false,
		secure: false,
		/*maxAge: 20*60*1000,*/
	},
	resave: true, //Reset maxAge counter
	rolling: true, //Session only expires if user is inactive for duration of maxAge
	secret: "sms-iwaly",
	store: sessionStore,
	unset: "destroy",
	saveUninitialized: true,
};

app.use("/", (req, res, next)=>{
	//Console.log the date and time
	console.log(getCurrDate());
	
	/*Answer the pre-flight request for allowed headers*/
	res.setHeader("Access-Control-Allow-Origin","http://localhost:3000");
	res.setHeader("Access-Control-Allow-Credentials",true);
	res.setHeader("Access-Control-Allow-Methods","GET, HEAD, OPTIONS, POST, PUT");
	res.setHeader("Access-Control-Allow-Headers","Cookie, Set-Cookie, Access-Control-Allow-Headers, " +
        "Origin, Accept, X-Requested-With, Content-Type, Access-Control-Request-Method," +
        "Access-Control-Request-Headers");
	res.setHeader("Content-Type","text/html");
	//Set the XML header
	if(req.method!=="OPTIONS") {
		next();
	} else {
		res.end("ok");
	}
});

//Route the request for <domain>/favicon.ico here before sessions begin
app.use(function (req, res, next) {
	/*The client browser couldn't allow setting the "cookie" header, so it's sent over via
      the "Set-Cookie" header and passed to the "cookie" header here on the server. Also,
      it's sent back via the <cookie></cookie> xml tags, extracted and added to the
      document.cookie using javascript. All this is just for the development version and
      is necessary because I'm violating the SOP.
    */
	if(req.headers["set-cookie"]) {
		req.headers.cookie = req.headers["set-cookie"][0];
	}
	next();
});

//Initialize sessions. PHP equivalent is session_start();
//Beyond this, session data can be set or read using req.session.session_property
//To logout, send path '/logout' and call a function to "unset or delete req.session"
app.use(session(session_options));
//Let the routing begin
//Logout route
app.use("/logout", logout);
app.use("/books", books);
app.use("/contact", express.static("./files"));
app.use("/about", express.static("./files"));
app.use("/images", express.static("./images"));
app.use("/pdf_download", express.static("./files"));
app.use("/signup", signup);
app.use("/log", login);
app.use("/",send_session_data);
//Set up routers to each of those modules
app.listen(80);
//callback for destroying session
function logout(req, res) {
	req.session.save((err)=>{
		if(err) {
			console.log(`couldn't save the session. An error occurred: ${err}`);
		} else {
			req.session.destroy((err)=>{
				if(err) {
					console.log(err.name);
					console.log(err.message);
					res.write("<msg>A problem happened.</msg>");
					res.end("<srv_res_status>1</srv_res_status>"); //NOT OK
				} else {
					res.write("<msg>Session successfully destroyed</msg>");
					res.end("<srv_res_status>0</srv_res_status>"); //OK
				}
			});
		}
		
	});
}
function send_session_data(req, res){
	//When user accesses the root of the server, return the session data.
	//Could be used to check whether or not the user is logged in.
	res.write("<?xml version='1.0' encoding='UTF-8' ?>");
	req.session.save((err)=>{
		if(err) {
			console.log(`Error: ${err.message}`);
			res.write("<msg>Error connection refused</msg>");
			res.write(`<cookie>${res.getHeader("Set-Cookie")}</cookie>`);
			res.statusCode = 500;
			console.log("Sent cookie: "+res.getHeader("Set-Cookie"));
			res.end("<srv_res_status>1</srv_res_status>"); //OK
		}
		if(req.session.uid) {

			let usr_data = {}; //Stringify and send to user.

			usr_data.alias = req.session.alias;
			usr_data.uid = req.session.uid;
			usr_data.sex = req.session.sex;
			usr_data.dob = req.session.dob;
			usr_data.pref = req.session.pref;
			usr_data.email = req.session.email;
			usr_data.about = req.session.about;
			usr_data.student = req.session.student;
			usr_data.school = req.session.school;
			//Copy a part of the session data and echo it back to the user.

			//Return JSON string of names and values to be parsed into an obj
			res.statusCode = 200;
			res.write(`<usr_info>${JSON.stringify(usr_data)}</usr_info>`);
			res.write(`<cookie>${res.getHeader("Set-Cookie")}</cookie>`);
			console.log("Sent cookie: "+res.getHeader("Set-Cookie"));
			res.end("<srv_res_status>0</srv_res_status>");
		} else {
			res.write("<msg>Just provide overhead.</msg>");
			res.write(`<cookie>${res.getHeader("Set-Cookie")}</cookie>`);
			res.statusCode = 200;
			console.log("Sent cookie: "+res.getHeader("Set-Cookie"));
			res.end("<srv_res_status>1</srv_res_status>"); //OK
		}
	});

}
function getCurrDate() {
	let dt  = new Date();
	//Get utc time in ms
	let utc = dt.getTime() + (dt.getTimezoneOffset() * 60000);
	//Create new date object for offset timezone
	let date = new Date(utc + (3600000 * 9));
	//YYYY:MM:DD HH:MM:SS Unix datetime string, mysql compatible
	let month = date.getMonth();
	month++; //Javascript month is 0 based. 0=January, 11=December
	if(month<10) {
		month="0"+month.toString();
	}
	let day = date.getDate();
	if(day<10) {
		day="0"+day.toString();
	}
	let hours = date.getHours();
	if(hours<10) {
		hours="0"+hours.toString();
	}
	let minutes = date.getMinutes();
	if(minutes<10) {
		minutes="0"+minutes.toString();
	}
	let seconds = date.getSeconds();
	if(seconds<10) {
		seconds="0"+seconds.toString();
	}
	return `${date.getFullYear()}-${month}-${day} ${hours}:${minutes}:${seconds}`;
}
//if res.getHeader('Set-Cookie') is called too quickly, it returns undefined, which is promptly written
//to the output. Solution: write something first as some kind of async timeout. By the time it's done,
//The cookie header is ready, the session has been generated. Async Astyncs.
//"http://api.bookmooch.com/api/asin?asins=4563022373&inc=Edition+ISBN+Binding+Title+Author+NumberOfPages+Publisher+PublicationDate&o=json"

let db_config = {
	host: "localhost",
	user: "aman",
	password: "password",
	database: "books"
};

let connection;

function handleDisconnect() {
connection = mysql.createConnection(db_config); // Recreate the connection, since
												// the old one cannot be reused.

connection.connect(function(err) {              // The server is either down
	if(err) {                                     // or restarting (takes a while sometimes).
	console.log('error when connecting to db:', err);
	setTimeout(handleDisconnect, 2000); // We introduce a delay before attempting to reconnect,
	}                                     // to avoid a hot loop, and to allow our node script to
});                                     // process asynchronous requests in the meantime.
										// If you're also serving http, display a 503 error.
connection.on('error', function(err) {
	console.log('db error', err);
	if(err.code === 'PROTOCOL_CONNECTION_LOST') { // Connection to the MySQL server is usually
	handleDisconnect();                         // lost due to either server restart, or a
	} else {                                      // connnection idle timeout (the wait_timeout
	throw err;                                  // server variable configures this)
	}
});
}

handleDisconnect();