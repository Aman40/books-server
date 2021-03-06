//This will handle everything to do with books. Connections to /books will be dealt with here
//These will be routed to /add, /find, delete and /edit_inventory
//Queries done on the home page search bar will also be routed here
//Likewise, the functions for /find and /edit_inventory will be housed here until they are too big
const express = require("express");
const router = express.Router();
const mysql = require("mysql");
const uuid = require("uuid/v4");
const { check, validationResult } = require("express-validator/check");
const url = require("url");
const formidable = require("formidable");
const fs = require("fs");
const events = require("events");
const PDFDocument = require("pdfkit");
// const fontkit = require("fontkit");

router.post("/alter/*", checkSession);

router.post("/alter/*", [ /*Validate form*/
	check("title")
		.not()
		.isEmpty()
		.withMessage("ER_NO_TITLE"),
	check("authors")
		.not()
		.isEmpty()
		.withMessage("ER_AUTH_LEN")
		.trim()
		.escape(),
	check("description")
		.optional({nullable: true, checkFalsy: true})
		.isLength({max: 1024})
		.withMessage("ER_DES_LEN") //Description too long
		.trim()
		.escape(),
	check("published")
		.isLength({max: 16})
		.withMessage("ER_PUBYR"),
	check("language")
		.not()
		.isEmpty()
		.withMessage("ER_NO_LANG"),
	check("edition")
		.optional({nullable: true, checkFalsy: true})
		.isLength({max: 128})
		.withMessage("ER_ILLEGAL_OP"),
	check("binding")
		.optional({nullable: true, checkFalsy: true})
		.withMessage("ER_NO_BINDING")
		.isIn(["paperback", "hardcover"])
		.withMessage("ER_ILLEGAL_OP"),
	check("pages")
		.optional({nullable: true, checkFalsy: true})
		.isNumeric()
		.withMessage("ER_PAGES"),
	check("publisher")
		.isLength({max: 255})
		.withMessage("ER_PUB_LEN")
		.trim()
		.escape(),
	check("isbn")
		.isLength({min: 10,max: 13})
		.trim()
		.escape(),
	check("condition")
		.optional({nullable: true, checkFalsy: true})
		.isLength({max: 255})
		.withMessage("ER_CON_LEN") //Description too long
		.trim()
		.escape(),
	check("location")
		.optional({nullable: true, checkFalsy: true})
		.isLength({max: 255})
		.withMessage("ER_LOC_LEN")
		.trim()
		.escape(),
	check("offer_expiry")
		.not()
		.isEmpty()
		.withMessage("ER_NO_EXP"),
	check("thumbnail")
		.optional({nullable: true, checkFalsy: true})
		.isLength({max: 255})
		.withMessage("ER_THUMB")
		.trim()
		.escape(),
], (req, res, next)=>{
	/*res.writeHead(200, {'Content-Type':'text/html', 'Access-Control-Allow-Origin': 'http://localhost:3000'});*/
	res.write("<?xml version='1.0' encoding='UTF-8' ?>");
	res.statusCode = 200;
	res.write(`<cookie>${res.getHeader("Set-Cookie")}</cookie>`); //DEV

	//Check the validation result here
	let result = validationResult(req);
	if(result.isEmpty()) {
		console.log("Passed the validation");
		next();
	} else {
		console.log("Failed the validation");
		//Format the errors and echo them back to the client
		//The query ends here
		//Return an array of validation results/errors. Only the first error
		let error_array = result.array({onlyFirstError: true});
		console.log(JSON.stringify(error_array));
		res.write(`<err_arr>${JSON.stringify(error_array)}</err_arr>`);
		res.write("<msg>There was a problem with the form entries</msg>");
		res.end("<srv_res_status>8</srv_res_status>");
	}
});

router.post("/search",[
	check("query")
		.optional({nullable: true, checkFalsy: true})
		.trim()
		.escape()
		.isLength({max: 255})
		.withMessage("QUERY_TOO_LONG")
],(req, res, next)=>{
	/*res.writeHead(200, {'Content-Type':'text/html', 'Access-Control-Allow-Origin': 'http://localhost:3000'});*/
	res.write("<?xml version='1.0' encoding='UTF-8' ?>");
	res.statusCode = 200;
	res.write(`<cookie>${res.getHeader("Set-Cookie")}</cookie>`); //DEV
	
	//Check the validation result here
	let result = validationResult(req);
	if(result.isEmpty()) {
		next();
	} else {
		//Format the errors and echo them back to the client
		//The query ends here
		//Return an array of validation results/errors. Only the first error
		let error_array = result.array({onlyFirstError: true});
	
		res.write(`<err_arr>${JSON.stringify(error_array)}</err_arr>`);
		res.write("<msg>There was a problem with the form entries</msg>");
	
		res.end("<srv_res_status>8</srv_res_status>");
	}
});

router.post("/alter/add", function (req, res) {
	res.write("<?xml version='1.0' encoding='UTF-8' ?>");
	res.write(`<cookie>${res.getHeader("Set-Cookie")}</cookie>`); //DEV
	let fields = url.parse(req.url, true).query;
	//Insert data into db and return
	const con = mysql.createConnection({
		host: "localhost",
		user: "aman",
		password: "password",
		database: "books"
	});
	con.connect((err)=>{
		if(err) {
			console.log("Connection failed:");
			console.log(err.name);
			console.log(err.message);
			res.end("<srv_res_status>6</srv_res_status>");
			return;
			// throw err; //Replace with a solution that won't crash the app
	}
	let sql = "INSERT INTO Books(`UserID`,`BookID`, `Title`, `Edition`, `Authors`, `Language`," +
            " `Description`," +
            "`Binding`, `PageNo`, `Publisher`, `Published`, `ISBN`, `Condition`," +
            "`Location` , `DateAdded`, `OfferExpiry`, `Thumbnail`) VALUES ?";

		let book_id = genUid("B");
		// Set the default for when page number is not defined to 0
		let pages = fields.pages;
		!pages?pages=0:pages;

		//Modify data for mysql. E.g true/false => 1/0
		if(!fields.edition) fields.edition=1;
		fields.is_new = fields.is_new?1:0;
		fields.deliverable = fields.deliverable?1:0;

		let form_fields = [[
			req.session.uid,
			book_id,
			fields.title,
			fields.edition,
			fields.authors,
			fields.language,
			fields.description,
			fields.binding,
			pages,
			fields.publisher,
			fields.published,
			fields.isbn,
			fields.condition,
			fields.location,
			fields.curr_date, //
			fields.offer_expiry,
			fields.thumbnail,
		]];

		con.query(sql, [form_fields], (err)=>{
			if(err) {
				console.log(err);

				if(err.code==="ER_INVALID_CHARACTER_STRING") {
					//Invalid characters used in the form. Send back code. Translate on client side
					res.write("<srv_res_status>2</srv_res_status>");
					res.end("<msg>Invalid characters in the form</msg>");
					return;
				} else {
					//Errors unrelated to the user
					res.write("<srv_res_status>4</srv_res_status>");
					res.end("<msg>A problem with the query occurred</msg>"); //Perhaps attempted SQL injection?
					return;
				}
			}
			//Return the book data. Don't wanna probe the db again. Mendokusai.

			let book_data = {
				book_id: fields.book_id,
				title: fields.title,
				edition: fields.edition,
				authors: fields.authors,
				description: fields.description,
				binding:  fields.binding,
				pages: fields.pages,
				publisher: fields.publisher,
				dublished: fields.published,
				isbn: fields.isbn,
				condition: fields.condition,
				location: fields.location,
				date_added: fields.curr_date,
				offer_expiry: fields.offer_expiry,
				thumbnail: fields.thumbnail,
			};

			//Return JSON string of names and values to be parsed into an obj
			res.write(`<books>${JSON.stringify(book_data)}</books>`);
			res.write("<msg>Successfully added the book!</msg>");
			res.end("<srv_res_status>0</srv_res_status>");
		});
	});
});

router.post("/alter/edit", function (req, res) {
	res.write("<?xml version='1.0' encoding='UTF-8' ?>");
	res.write(`<cookie>${res.getHeader("Set-Cookie")}</cookie>`); //DEV

	let fields = url.parse(req.url, true).query;
	//Insert data into db and return
	const con = mysql.createConnection({
		host: "localhost",
		user: "aman",
		password: "password",
		database: "books"
	});
	con.connect((err)=>{
		if(err){
			console.log("Connection failed:");
			console.log(err.name);
			console.log(err.message);
			res.end("<srv_res_status>6</srv_res_status>");
			return;
		} //throw err; //Replace with a solution that won't crash the app
		//Modify data for mysql. E.g true/false => 1/0
		if(!fields.edition) fields.edition=1;
		fields.is_new = fields.is_new==="true"?1:0;
		fields.deliverable = fields.deliverable==="true"?1:0;

		let book_id = fields.book_id;
		// Set the default for when page number is not defined to 0
		let pages = fields.pages;
		!pages?pages=0:pages;

		let sql = "UPDATE Books SET `Title`=?, `Edition`=?, `Authors`=?, `Language`=?, `Description`=?," +
            "`Binding`=?, `PageNo`=?, `Publisher`=?, `Published`=?, `ISBN`=?, `Condition`=?," +
            "Location`=?, `DateAdded`=?, `OfferExpiry`=?, `Thumbnail`=? WHERE `UserID`=? AND `BookID`=?";

		let form_fields = [
			fields.title,
			fields.edition,
			fields.authors,
			fields.language,
			fields.description,
			fields.binding,
			pages,
			fields.publisher,
			fields.published,
			fields.isbn,
			fields.condition,
			fields.location,
			fields.curr_date,
			fields.offer_expiry,
			fields.thumbnail,
			req.session.uid,
			book_id
		];

		con.query(sql, form_fields, (err)=>{
			if(err) {
				console.log(err);
				console.log(con.query);

				if(err.code==="ER_INVALID_CHARACTER_STRING") {
					//Invalid characters used in the form. Send back code. Translate on client side
					res.write("<srv_res_status>2</srv_res_status>");
					res.end("<msg>Invalid characters in the form</msg>");
					return;
				} else {
					//Errors unrelated to the user
					res.write("<srv_res_status>4</srv_res_status>");
					res.end("<msg>A problem with the query occurred</msg>"); //Perhaps attempted SQL injection?
					return;
				}
			}
			console.log(req.session.uid);
			console.log(book_id);
			//Return the book data. Don't wanna probe the db again. Mendokusai.
			let book_data = {
				book_id: fields.book_id,
				title: fields.title,
				edition: fields.edition,
				authors: fields.authors,
				description: fields.description,
				binding:  fields.binding,
				pages: fields.pages,
				publisher: fields.publisher,
				isbn: fields.isbn,
				is_new: fields.is_new,
				condition: fields.condition,
				location: fields.location,
				date_added: fields.curr_date,
				offer_expiry: fields.offer_expiry,
				thumbnail: fields.thumbnail,
			};

			//Return JSON string of names and values to be parsed into an obj
			res.write(`<books>${JSON.stringify(book_data)}</books>`);
			res.write("<msg>Successfully added the book!</msg>");
			res.end("<srv_res_status>0</srv_res_status>");
		});
	});
});

router.use("/delete", function(req, res){
	/**
	 * srv_res_statuses:
	 * 0. successfully completed
	 * 1. mysql error with connection to db
	 * 2. Partial success
	 * 3. All queries failed
	 */
	// res.write("<?xml version='1.0' encoding='UTF-8' ?>");
	// res.write(`<cookie>${res.getHeader("Set-Cookie")}</cookie>`); //DEV
	//Expect a stringified array of bookids to delete
	//e.g ['bookid1', 'bookid2', ..., 'bookidN']
	console.log(url.parse(req.url, true).query);
	let bookIDs = JSON.parse(url.parse(req.url, true).query.booksArr);
	/**
		 * Instantiate the manager. While the queries are all triggered
		 * nearly in parallel and asynchronously, they'll still refer
		 * to the same manager object, thanks to Javascript objects'
		 * immutability
		 */
	let bdm = new BookDeleteManager(bookIDs.length);

	const con = mysql.createConnection({
		host: "localhost",
		user: "aman",
		password: "password",
		database: "books"
	});
	con.connect((err)=>{
		if(err) {
			console.log(err);
			let resObj = {};
			resObj.srv_res_status = 0;
			resObj.msg = "Connection to db failed";
			res.write(JSON.stringify(resObj));
			res.end();
		}
		
		for(let i=0;i<bookIDs.length;i++) {
			//Delete one by one
			let sql = "DELETE FROM Books WHERE BookID='"+bookIDs[i]+"'";
			// console.log(sql);
			con.query(sql, (err, result)=>{
				if(err) {
					//Report a failure
					console.log(JSON.stringify(err));
					bdm.failed();
				} else {
					//Success. Check the result
					// console.log(JSON.stringify(result));
					//check the result object to determine if any rows were affected.
					//{"fieldCount":0,
					//"affectedRows":1,
					//"insertId":0,
					//"serverStatus":2,
					//"warningCount":0,
					//"message":"",
					//"protocol41":true,
					//"changedRows":0}
					if(result.affectedRows===1) {
						bdm.succeeded();
					} else {
						//Actually, non-existant. Very unlikely to happen with good
						//Programming (which I do, btw)
						bdm.failed();
					}
				}
				//If all queries are done, return
				if(bdm.weAreDone()){
					let resObj = {};
					if(bdm.counter.failed===0) {
						//Full success
						resObj.srv_res_status = 0;
						resObj.msg = "Full success";
					} else if(bdm.counter.succeeded===0) {
						//Full failure
						resObj.srv_res_status = 3;
						resObj.msg = "All queries failed";
					} else {
						//Partial success or failure. You decide
						resObj.srv_res_status = 2;
						resObj.msg = "All queries succeeded";
					}
					res.write(JSON.stringify(resObj));
					res.end();
				}
			});
		}
	});
});

router.use("/fetch", (req,res)=>{
	//Fetches only logged in user's books
	getMyBooks(req, res, (result)=>{
		if(result.length===0) {
			//User has no books to show :(
			console.log("/fetch is empty!");
			res.write("<srv_res_status>3</srv_res_status>");
			res.end("<msg>No results found</msg>");
			return;
		} else {
			let Books = [];
			let _tmpBook = {};
			_tmpBook.images = [];
			let curr__book = result.pop();
			res.write(`<bks_info>${JSON.stringify(refactor_book_results(Books, result, curr__book, _tmpBook))}</bks_info>`);
			res.write("<msg>Got your books, boss! Dev</msg>");
			res.end("<srv_res_status>0</srv_res_status>");
		}
	});
});

router.use("/images/upload", (req, res)=>{
	res.write("<?xml version='1.0' encoding='UTF-8' ?>");
	res.statusCode = 200;
	res.write(`<cookie>${res.getHeader("Set-Cookie")}</cookie>`); //DEV
	//Use

	let form = new formidable.IncomingForm();
	form.keepExtensions = true;
	form.maxFileSize = 25 * 1024 * 1024; //Allow up to a combined 25 MB
	form.multiples = true;

	const conn = mysql.createConnection({
		host: "localhost",
		user: "aman",
		password: "password",
		database: "books"
	});
	conn.connect((err)=>{
		if(err) {
			console.log("Connection failed:");
			console.log(err.name);
			console.log(err.message);
			res.end("<srv_res_status>6</srv_res_status>");
			return;
		}

		form.parse(req, (err, fields, files)=>{
			if(err) {
				console.log(err.name);
				console.log(err.message);
				res.end("<srv_res_status>6</srv_res_status>");
				return;
			}

			let am = new AsyncUploadManager(Object.getOwnPropertyNames(files).length); // TODO: This seems dangerous. Find a better way

			for(let name in files) {
				//Maintaining the same connection, upload the file details one by one,
				//Moving the file after each successful addition of info to db
				let sql = "INSERT INTO BookImgs(`ImgID`, `BookID`, `ImageURI`)" +
                    "VALUES ?";
				let fileData = {};
				fileData.imgID = genUid("I");
				fileData.bookID = fields.bookID;
				fileData.imgURI = "http://localhost:8000/images/"+fileData.imgID+".jpeg";
				fileData.oldPath = files[name].path;
				fileData.newPath = "/var/www/html/books/books-webApp/Server/images/"+fileData.imgID+".jpeg";
				let form_fields = [[
					fileData.imgID,
					fileData.bookID,
					fileData.imgURI
				]];

				fs.rename(fileData.oldPath, fileData.newPath, (err)=>{
					if(err) {
						console.log("An error occured: "+err);
						am.emit("error", err, res, "add_img");
					} else {
						//Emit an event if completion events
						//Catch the event for when the last file is done
						conn.query(sql, [form_fields], (err)=>{
							if(err) { //Mysql error
								console.log(err);
								am.emit("error", err, res, "add_img");
							}
							else {
								//VULNERABILITY: Without the userID attatched to the BookImgs table,
								//Any user can potentially add images for any other user's books
								//Provided they know it's BookID
								//Anyway, no errors in the SQL, move the file
								am.emit("completed", res, fileData.newPath);
							}
						});
					}
				});
			}
		});
	});
});

router.use("/images/delete", (req, res)=>{
	//1. Get the list of images
	//2. create a connection to the db
	//3. Looping through the images, delete each then
	//4. run the delete query first then unlink from the disk
	res.write("<?xml version='1.0' encoding='UTF-8' ?>");
	res.statusCode = 200;
	res.write(`<cookie>${res.getHeader("Set-Cookie")}</cookie>`); //DEV
	//Use
	let fields = JSON.parse(url.parse(req.url, true).query.id_arr);
	console.log("Deleting Fields: "+fields);

	const con = mysql.createConnection({
		host: "localhost",
		user: "aman",
		password: "password",
		database: "books"
	});

	con.connect((err)=>{
		if(err) {
			console.log("Connection to mysql server failed");
			console.log(err.name);
			console.log(err.message);"";
			res.end("<srv_res_status>6</srv_res_status>");
			return;
		}
		//Start async manger
		let am = new AsyncUploadManager(fields.length); //Annonce expected number of files.

		for(let i =0; i<fields.length;i++) {
			//TODO:
			// Vulnerability: Attacker could change id for an image to "*" hence dropping
			//all images in db. Try it.
			// Defence: For each of the images, check the length = 13 characters. //LATER
			//Also append BookID so only said user's images are deleted
			let sql = "DELETE FROM BookImgs WHERE ImgID='"+fields[i]+"'";
			con.query(sql, (err)=>{
				if(err) {
					am.emit("error", err, res, "del_img");
				}  else {
					am.emit("completed", res, fields[i]);
				}
			});
		}
	});
});

router.use("/all", (req, res)=>{
	//Fetches all the books, not specific to any user. In future, this will be tailored according to location of the client.
	res.write("<?xml version='1.0' encoding='UTF-8' ?>");
	res.write(`<cookie>${res.getHeader("Set-Cookie")}</cookie>`); //DEV
	//Fetch 25 - 50 books at a time depending on how many the user specifies with
	//The "show" filter
	const con = mysql.createConnection({
		host: "localhost",
		user: "aman",
		password: "password",
		database: "books"
	});
	con.connect((err)=>{
		if(err) {
			console.log("Connection to mysql server failed:");
			console.log(err.name);
			console.log(err.message);
			res.end("<srv_res_status>6</srv_res_status>");
			return;
			// console.log("Couldn't connect to the db");
			//Return appropriate error to user. TODO LATER
		}

		const fetch_max = 25; //Others will be 50, 75, 100, all specified by the client.
		const sql = "SELECT Transient.BookID AS BookID," +
            "Transient.UserID AS UserID," +
            "Transient.Title AS Title," +
            "Transient.Edition AS Edition," +
            "Transient.Authors AS Authors," +
            "Transient.Description AS Description," +
            "Transient.Language as Language,"+
            "Transient.Binding AS Binding," +
            "Transient.PageNo AS PageNo," +
            "Transient.Publisher AS Publisher," +
            "Transient.Published AS Published," +
            "Transient.ISBN as ISBN," +
			"Transient.Condition AS `Condition`," +
			"Transient.Location AS `Location`," +
            "Transient.DateAdded AS DateAdded," +
            "Transient.OfferExpiry AS OfferExpiry," +
			"Transient.BookSerial AS BookSerial," +
			"Transient.Thumbnail AS Thumbnail," +
            "BookImgs.ImageURI AS ImageURI," +
            "BookImgs.ImgID AS ImgID FROM (SELECT * FROM `Books`  ORDER BY `BookSerial` " +
            "DESC LIMIT "+fetch_max+") AS Transient LEFT JOIN " +
            "BookImgs ON Transient.BookID=BookImgs.BookID ORDER BY `BookSerial`";

		con.query(sql, (err, result)=>{
			if(err) {
				//Errors unrelated to the user
				console.log(err.msg);
				res.write("<srv_res_status>4</srv_res_status>");
				res.write(`<err>${err.name}</err>`);
				res.end(`<err>${err.message}</err>`); //Perhaps attempted SQL injection?
				return;
			}
			if(result.length===0) {
				//The entire db is empty!
				console.log("/all is empty");
				res.write("<srv_res_status>3</srv_res_status>");
				res.end("<msg>No results found</msg>");
				return;
			} else {
				let Books = [];
				let _tmpBook = {};
				_tmpBook.images = [];
				let curr__book = result.pop();
				res.write(`<bks_info>${JSON.stringify(refactor_book_results(Books, result, curr__book, _tmpBook))}</bks_info>`);
				res.write("<msg>Got your books, boss! Dev</msg>");
				res.end("<srv_res_status>0</srv_res_status>");
			}
		});
	});
});

router.use("/search", (req, res)=>{
	/**
	 * Searches for books matching a certain query using mysql's FULL TEXT WITH 
	 * NATURAL LANGUAGE functionality against Books(Title, Authors, Description). Sort
	 * results according to relevance
	 */
	res.write("<?xml version='1.0' encoding='UTF-8' ?>");
	res.write(`<cookie>${res.getHeader("Set-Cookie")}</cookie>`); //DEV
	//Fetch 25 - 50 books at a time depending on how many the user specifies with
	//The "show" filter
	const con = mysql.createConnection({
		host: "localhost",
		user: "aman",
		password: "password",
		database: "books"
	});
	con.connect((err)=>{
		if(err) {
			console.log("Connection to mysql server failed:");
			console.log(err.name);
			console.log(err.message);
			res.end("<srv_res_status>6</srv_res_status>");
			return;
			// console.log("Couldn't connect to the db");
			//Return appropriate error to user. TODO LATER
		}
		const query = url.parse(req.url, true).query.query;
		const fetch_max = 25; //Others will be 50, 75, 100, all specified by the client.
		const sql = "SELECT Transient.BookID AS BookID," +
            "Transient.UserID AS UserID," +
            "Transient.Title AS Title," +
            "Transient.Edition AS Edition," +
            "Transient.Authors AS Authors," +
            "Transient.Description AS Description," +
            "Transient.Language as Language,"+
            "Transient.Binding AS Binding," +
            "Transient.PageNo AS PageNo," +
            "Transient.Publisher AS Publisher," +
            "Transient.Published AS Published," +
            "Transient.ISBN as ISBN," +
			"Transient.Condition AS `Condition`," +
			"Transient.Location AS `Location`," +
            "Transient.DateAdded AS DateAdded," +
            "Transient.OfferExpiry AS OfferExpiry," +
			"Transient.BookSerial AS BookSerial," +
			"Transient.Thumbnail AS Thumbnail," +
            "BookImgs.ImageURI AS ImageURI," +
			"BookImgs.ImgID AS ImgID FROM (SELECT * FROM `Books`"+
			"WHERE MATCH(Title, Edition, Authors, Description) AGAINST('"+query+"')"+
			" ORDER BY `BookSerial` " +
            "DESC LIMIT "+fetch_max+") AS Transient LEFT JOIN " +
            "BookImgs ON Transient.BookID=BookImgs.BookID ORDER BY `BookSerial`";
		con.query(sql, (err, result)=>{
			if(err) {
				//Errors unrelated to the user
				console.log(err.msg);
				res.write("<srv_res_status>4</srv_res_status>");
				res.write(`<err>${err.name}</err>`);
				res.end(`<err>${err.message}</err>`); //Perhaps attempted SQL injection?
				return;
			}
			if(result.length===0) {
				//The entire db is empty!
				res.write("<srv_res_status>3</srv_res_status>");
				res.end("<msg>No results found</msg>");
				return;
			} else {
				let Books = [];
				let _tmpBook = {};
				_tmpBook.images = [];
				let curr__book = result.pop();
				res.write(`<bks_info>${JSON.stringify(refactor_book_results(Books, result, curr__book, _tmpBook))}</bks_info>`);
				res.write("<msg>Got your books, boss! Dev</msg>");
				res.end("<srv_res_status>0</srv_res_status>");
			}
		});
	});
});

function checkSession(req, res, next){
	//DEV:
	console.log("Sent cookie: "+res.getHeader("Set-Cookie"));
	if(req.session.uid) {
		console.log("Is logged in.");
		next(); //The user is logged in or not. If not, they shouldn't be here. Prompt them to log in.
	} else {
		//Return an appropriate response to let the user know that their session is expired
		/*res.writeHead(200, {'Content-Type':'text/html', 'Access-Control-Allow-Origin': 'http://localhost:3000'});*/
		console.log("Not logged in");
		res.write("<?xml version='1.0' encoding='UTF-8' ?>");
		res.write(`<cookie>${res.getHeader("Set-Cookie")}</cookie>`); //DEV
		res.write("<msg>Please log in again.</msg>");
		res.statusCode = 200;
		res.statusText = "OK";
		res.end("<srv_res_status>9</srv_res_status>");
	}
}
function AsyncUploadManager(total_file_count){
	//Works with deleting multiple images as well
	//Add a timeout of 5 seconds (proportional to file total size in future) to abort
	//Maintain a list of moved files to be removed as a rollback scheme should any
	//of the queries fail.
	this.completedFileList = [];
	this.em = new events.EventEmitter();
	this.totalFileCount = total_file_count;
	this.filesCompleted = 0;
	this.em.on("completed", (restArgs)=>{
		//Called each time a file is successfully added for addition or deleted for deletion
		//Both the query and file system completed successfully
		let res=restArgs[0];
		let filename=restArgs[1];
		this.filesCompleted++;

		console.log(`Moved ${this.filesCompleted} files out of ${this.totalFileCount} files`);

		this.completedFileList.push(filename);
		if(this.filesCompleted===this.totalFileCount) {
			//Check if all the expected files have been completed before returning a response
			//That's the whole purpose of this object
			//End the request
			res.write("<msg>Successfully added or deleted the Images!</msg>");
			res.end("<srv_res_status>0</srv_res_status>");
		}
	});
	this.em.on("error", (restArgs)=>{
		//The operation ended halfway only after moving the file. The query wasn't performed
		//Mysql error
		// let err = restArgs[0];
		let res = restArgs[1];
		let ctx = restArgs[2];
		console.log("An error occurred: "+restArgs[0]);
		//Rollback all the files that have been moved so far
		for(let i = 0; i<this.completedFileList.length;i++) {
			if(ctx==="add_img") {
				console.log("Query failed after moving file: "+this.completedFileList[i]);
			} else if(ctx==="del_img") {
				console.log("Query failed after deleting reference to file: "+this.completedFileList[i]);
			}
		}
		res.write("<srv_res_status>4</srv_res_status>");
		res.end("<msg>A problem with the query occurred</msg>"); //Perhaps attempted SQL injection?
		//Abort the file uploads and rollback whatever!
	});

	this.emit = (event, ...restArgs)=>{
		//'error', err, res OR 'completed', res, newpath
		//Using restArgs here to deal with both adding and deleting which require a different number of arguments
		this.em.emit(event, restArgs);
	};
}

router.use("/generatePDF", (req, res)=>{
	/**
	 * This route gets all the user's books fromt the database and generates a 
	 * pdf catalog for download
	 */
	//fetch the books from the db
	getMyBooks(req, res, (result)=>{
		if(result.length===0) {
			//User has no books to show :(
			//Now we generate the pdf
			
			console.log("/fetch is empty!");
			res.write("<srv_res_status>3</srv_res_status>");
			res.end("<msg>No results found</msg>");
			return;
		} else {
			let Books = [];
			let _tmpBook = {};
			_tmpBook.images = [];
			let curr__book = result.pop();
			let booksArr = refactor_book_results(Books, result, curr__book, _tmpBook); //Array of book objects
			//Generate pdf
			// let docPath = "./files/testfile.pdf";

			// let doc = new PDFDocument();
			// doc.pipe = fs.createWriteStream(docPath);
			// doc.font("fonts/PalatinoBold.ttf")
			// 	.fontSize(25)
			// 	.text("Some text with an embedded font!", 100, 100);

			// // # Add another page
			// doc.addPage()
			// 	.fontSize(25)
			// 	.text("Here is some vector graphics...", 100, 100);

			// // # Draw a triangle
			// doc.save()
			// 	.moveTo(100, 150)
			// 	.lineTo(100, 250)
			// 	.lineTo(200, 250)
			// 	.fill("#FF3300");

			// // # Apply some transforms and render an SVG path with the 'even-odd' fill rule
			// doc.scale(0.6)
			// 	.translate(470, -380)
			// 	.path("M 250,75 L 323,301 131,161 369,161 177,301 z")
			// 	.fill("red", "even-odd")
			// 	.restore();

			// // # Add some text with annotations
			// doc.addPage()
			// 	.fillColor("blue")
			// 	.text("Here is a link!", 100, 100)
			// 	.underline(100, 100, 160, 27, {color: "#0000FF"})
			// 	.link(100, 100, 160, 27, "http://google.com/");

			// # Finalize PDF file
			// doc.end();

			//Generate txt file until we figure out what's going on.
			// let data = [
			// 	"If you think about it, my level of productivity\n",
			// 	"is nearly constant\n",
			// 	"if I drink coffee today\n",
			// 	"and get into hyperproductive mode, \n",
			// 	"the next day I'll be just productive enough that\n",
			// 	"the average productivity of the two days\n",
			// 	"is just my standard productivity\n",
			// 	"Interesting theory, innit?"
			// ];
			
			try{
				let docPath = `./files/${req.session.uid}.txt`;
				let fd = fs.openSync(docPath,"w");
				fs.appendFileSync(fd, `Alias name: ${req.session.alias}\n`);
				fs.appendFileSync(fd, `Number of books: ${booksArr.length}\n`);
				for(let i=0; i<booksArr.length; i++){
					fs.appendFileSync(fd, `Book number #${i}\n`);
					Object.getOwnPropertyNames(booksArr[i]).forEach((prop)=>{
						fs.appendFileSync(fd, `${prop}\t: ${JSON.stringify(booksArr[i][prop])}\n`);
					});
					fs.appendFileSync(fd, "*******************************************************\n\n");
				}
				fs.closeSync(fd);
				//Download pdf.
				// res.write(JSON.stringify(booksArr));
				res.write(`<filename>${req.session.uid}.txt</filename>`);
				res.end("<srv_res_status>0</srv_res_status>");
			} catch(err) {
				res.write(`File creation failed with an error ${JSON.stringify(err)}</msg>`);
				res.end("<srv_res_status>6</srv_res_status>");
			}
		}
	});
	//generate the pdf file

	//download the file
});

function genUid(char) {
	//This is meant to function as the php uid(index) function, generating a 14 character uid starting with the
	//provided index. If I get more of such I'll create a separate module
	let str = uuid(); //Gives a 36 character string with hyphenes.
	str = str.split("-"); //Gives an array
	let _tmp = "";
	for(let i = 0; i<str.length; i++) { //Concatenate it back into a string
		_tmp+=str[i];
	}
	return char+_tmp.toString().slice(0,13); //Get 13 characters, concat the first char = 14 characters;
}

function getMyBooks(req, res, callback){
	//Fetches only logged in user's books
	res.write("<?xml version='1.0' encoding='UTF-8' ?>");
	res.write(`<cookie>${res.getHeader("Set-Cookie")}</cookie>`); //DEV
	//Fetch 25 - 50 books at a time depending on how many the user specifies with
	//The "show" filter
	const con = mysql.createConnection({
		host: "localhost",
		user: "aman",
		password: "password",
		database: "books"
	});

	con.connect((err)=>{
		if(err) {
			console.log("Connection to mysql server failed:");
			console.log(err.name);
			console.log(err.message);
			res.end("<srv_res_status>6</srv_res_status>");
			return;
			// console.log("Couldn't connect to the db");
			//Return appropriate error to user. TODO LATER
		}

		const fetch_max = 25; //Others will be 50, 75, 100, all specified by the client.
		const sql = "SELECT Transient.BookID AS BookID," +
            "Transient.UserID AS UserID," +
            "Transient.Title AS Title," +
            "Transient.Edition AS Edition," +
            "Transient.Authors AS Authors," +
            "Transient.Description AS Description," +
            "Transient.Language as Language,"+
            "Transient.Binding AS Binding," +
            "Transient.PageNo AS PageNo," +
            "Transient.Publisher AS Publisher," +
            "Transient.Published AS Published," +
			"Transient.ISBN as ISBN," +
			"Transient.Condition AS `Condition`," +
			"Transient.Location AS Location," +
            "Transient.DateAdded AS DateAdded," +
            "Transient.OfferExpiry AS OfferExpiry," +
			"Transient.BookSerial AS BookSerial," +
			"Transient.Thumbnail AS Thumbnail," +
            "BookImgs.ImageURI AS ImageURI," +
            "BookImgs.ImgID AS ImgID FROM (SELECT * FROM (SELECT * FROM `Books` " +
            "WHERE `UserID`='"+req.session.uid+"') AS TempTable ORDER BY `BookSerial` " +
            "DESC LIMIT "+fetch_max+") AS Transient LEFT JOIN " +
            "BookImgs ON Transient.BookID=BookImgs.BookID ORDER BY Transient.BookSerial";
		con.query(sql, (err, result)=>{
			if(err) {
				//Errors unrelated to the user
				console.log("An error with the sql");
				console.log("Err Name: "+err.name);
				console.log("Err Msg: "+err.msg);
				for(let i in err) {
					console.log(`Err.${i} = ${err[i]}`);
				}
				res.write("<srv_res_status>4</srv_res_status>");
				res.write(`<err>${err.name}</err>`);
				res.end(`<err>${err.message}</err>`); //Perhaps attempted SQL injection?
				return;
			}
			callback(result);
		});
	});
}

function refactor_book_results(Books, result, curr_book, _tmpBook) {
	/**
	 * The query returns result rows as an array. Only the ImageURIs are unique from
	 * row to row, so a single book with 5 images will have 5 rows. This function
	 * refactors the 5 rows into one object with an \images\ property as an array
	 * of image objects. 
	 * In effect, the result is modified into an array of unique book objects
	 */

	//Pop the first book prior, into curr_book
	let nxt_book = result.pop();

	if(!nxt_book) {
		//Last item. Insert the current image and remaining data and close it up
		//If there's no image, insert nothing.
		if(curr_book.ImgID) {
			let _tmpImg = {};
			_tmpImg.ImgID = curr_book.ImgID;
			_tmpImg.BookID = curr_book.BookID;
			_tmpImg.ImgURI = curr_book.ImageURI;
			_tmpBook.images.push(_tmpImg); //Push the image
		}

		let keys = Object.keys(curr_book);
		for(let i=0;i<keys.length;i++) {
			//Copy the properties, all except imgid
			if(keys[i]!=="ImgID") {
				_tmpBook[keys[i]] = curr_book[keys[i]];
			}
		}
		//push the book to the Books array and return Books;
		Books.push(_tmpBook);
		return Books;
	} else {
		//not last item. Check if it's the same item
		if(curr_book.BookID===nxt_book.BookID) {
			//Same book. push() the image to. Only 3 properties. no need to for loop through keys
			if(curr_book.ImgID) {
				let _tmpImg = {};
				_tmpImg.ImgID = curr_book.ImgID;
				_tmpImg.BookID = curr_book.BookID;
				_tmpImg.ImgURI = curr_book.ImageURI;
				_tmpBook.images.push(_tmpImg); //Push the image
			}
			//Redefine curr_book and recurse
			curr_book = nxt_book;
			return refactor_book_results(Books, result, curr_book, _tmpBook);
		} else {
			//Last image of book. Push the current  image and remaining data into Books and reiterate
			if(curr_book.ImgID) {
				let _tmpImg = {};
				_tmpImg.ImgID = curr_book.ImgID;
				_tmpImg.BookID = curr_book.BookID;
				_tmpImg.ImgURI = curr_book.ImageURI;
				_tmpBook.images.push(_tmpImg); //Push the image
			}

			let keys = Object.keys(curr_book);
			for(let i=0;i<keys.length;i++) {
				//Copy the properties, all except imgid. We already handled that
				if(keys[i]!=="ImgID") {
					_tmpBook[keys[i]] = curr_book[keys[i]];
				}
			}
			//push the book to the Books array and return reiterate afresh.
			Books.push(_tmpBook);
			_tmpBook = {};
			_tmpBook.images = [];
			//Redefine curr_book and recurse
			curr_book = nxt_book;
			return refactor_book_results(Books, result, curr_book, _tmpBook);
		}
	}
}

function BookDeleteManager(numberOfQueries) {
	/**
	 * This is not really necessary but helps running the delete queries in a for loop.
	 * It keeps track of the total number of queries completed, number of successes
	 * and number of failures. 
	 * Normally, the request would return after a single error because all the steps in
	 * processing the request are sequential and in a waterfall pattern, meaning a 
	 * failure at one point triggers the domino effect down the line.
	 * In this case though, a db query single failure (unless it's a connection failure) 
	 * shouldn't be able to stop processing of the request because the queries are 
	 * independent of each other. 
	 * So when an error occurs, simply take note of it and continue processing other db
	 * queries. When EVERYTHING is done, report what succeeded and what failed.
	 */
	this._queryCount = numberOfQueries; //The total number of books to delete
	this.counter = {
		completed: 0,
		succeeded: 0,
		failed: 0,
	};

	this.succeeded = ()=>{
		//Increment the number of succeeded queries then check if we're done
		this.counter.completed++;
		this.counter.succeeded++;
	};
	this.failed = ()=>{
		//Increment the number of failed queries then check if we're done
		this.counter.completed++;
		this.counter.failed++;
	};
	this.weAreDone = ()=>{
		return this.counter.completed === this._queryCount;
	};
}

module.exports = router;
//DESCRIPTION OF EXIT CODES/RETURN STATUSES srv_res_status
//0: Success
//1: Duplicate entry of email or alias
//2: Illegal characters in input
//3: No results found
//4: Query error
//5: Connect error
//6: Other system errors
//7: Passwords don't match
//8: Error in form
//9: Not logged in

//req.session is invisible in here. Why?
/*
1.  Seems like the OPTIONS pre-flight check is not detected by app.options() when sent via "POST"
    It's only caught when sent via GET. So using router.options() is not a very good idea when sending via POST.
    The pre-flight check request will likely fail.
2.  Never forget to set the "Content-Type","text/html" headers, or you'll waste about 8 hours debugging.
*/
/*
* Need to retrieve items together with their images from the db
* Need 2 separate tables, 1 for the items, 1 for the images
* I don't wanna join the tables. Time complexity issues
* I could fetch
* // TODO: Create add a section for past papers. Think about implementation Later
* */
