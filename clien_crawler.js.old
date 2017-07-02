//load libraries..
let cheerio = require('cheerio');
let request = require('request');
let archive = require('archive.is');
let superagent = require('superagent');
let schedule = require('node-schedule');
let sqlite3 = require('sqlite3');

//set request to save cookies.
var db = new sqlite3.Database('./db/user.db');
var j = request.jar()
var cookie_saved_request = request.defaults({jar:j})


//functions start.

function work(user_id, password) {
    cookie_saved_request({
        method: 'POST',
        url: 'https://www.clien.net/cs2/bbs/login_check.php',
        form: {
            mb_id: user_id,
            mb_password: password
        }
    }, function(err, response, body) {
        if(err) {
            console.log(err);
        }
        else {
			//get blacklist user ids..
			console.log("login complete. get separated user id");
			console.log(body);
			get_blacklist().then(rows => {
				if(rows.length == 0) {
					console.log("there is no blacklist user. exit.");
				}
				else {
					rows.forEach(function(row, index) {
						findAndArchive(row.USER_ID);
					});
				}
			})
			.catch(err => console.log(err));
        }
    })
}

function findAndArchive(target_user_id) {
	cookie_saved_request({
		method: 'GET',
        //url: 'http://www.clien.net/cs2/bbs/board.php?bo_table=park&sca=&sfl=mb_id%2C1&stx=${user_id}&x=0&y=0',
        url: 'http://www.clien.net/cs2/bbs/board.php?bo_table=park&sca=&sfl=mb_id%2C0&stx=' + target_user_id + '&x=0&y=0',
        headers: {
        	'Referer': 'http://www.clien.net/cs2/bbs/board.php?bo_table=park&sca=&sfl=mb_id%2C1&stx=' + target_user_id + '&x=0&y=0'
        		}
        }, function(err, response, body) {
			if (err) return console.error(err);
			$ = cheerio.load(body);
			console.log("==================================================");
			console.log(`get all article of [${target_user_id}] wrote.`);
			console.log("==================================================");
			$('tr.mytr').each(function() {
				var subject = $('td.post_subject', this);
                var title = subject.text();
				if(title.startsWith('-차단하신')) {
					console.log("!!!!! IGNORED ARTICLE. PASS !!!!!");
				}
				else {
                var article_no = $('a', subject).attr('href').split('&')[0].split('≀')[1].split('=')[1];
                var article_link = `http://www.clien.net/cs2/bbs/board.php?bo_table=park&wr_id=${article_no}`;
                var user = $('td.post_name a', this).attr('title');
                var user_id = user.split(']')[0].replace('[','');
                var user_name = user.split(']')[1];
 
                var created_at = $('span',$('td', this).eq(3)).attr('title');
                checkExistAndSave(target_user_id, user_id, user_name, article_no, title, article_link, created_at);
				}
			});
		});
}

function createTable() {
    console.log("initialize db.. create table if not exists..");
    db.run("CREATE TABLE IF NOT EXISTS SENT_USER(ID INTEGER PRIMARY KEY,TARGET_ID TEXT, USER_ID TEXT, USER_NAME TEXT,ARTICLE_NO INTEGER, TITLE TEXT, URL TEXT, SHORTEN TEXT, CREATED_AT DATE)");
	console.log("create blacklist user table if not exist..");
	db.run("CREATE TABLE IF NOT EXISTS BLACKLIST_USER(ID INTEGER PRIMARY KEY, USER_ID TEXT)");
}

function insert(target_user_id, user_id, user_name, article_no, title, url, shorten, created_at) {
    var statement = db.prepare("INSERT INTO SENT_USER (TARGET_ID, USER_ID, USER_NAME, ARTICLE_NO, TITLE, URL, SHORTEN, CREATED_AT) VALUES (?, ?, ?, ?, ?, ?, ?, ?)");
    statement.run(target_user_id, user_id, user_name, article_no, title, url, shorten, created_at);
    statement.finalize();
}

function checkExistAndSave(target_user_id, user_id, user_name, article_no, title, url, created_at) {
    var preparedStmt = "SELECT USER_ID FROM SENT_USER WHERE ARTICLE_NO = " + article_no + " AND TARGET_ID = '" + target_user_id + "'";
    db.all(preparedStmt, function(err, rows) {
		if(err) {
			console.log(preparedStmt);
			console.log(err);
		}
        else if(rows && rows.length == 0) {
            console.log(`[no : ${article_no}], [title : ${title}] is not saved. archive and save this article..`);
            archive.save(url).then(function(result) {
                var shorten = result.shortUrl;
                console.log(`[!NEW!]   user [${target_user_id}] written Article no(${article_no}),  title : (${title}) is now archived(${shorten}). saving this article..`);
                insert(target_user_id, user_id, user_name, article_no, title, url, shorten, created_at);
            });
        }
        else {
            console.log(`[!EXIST!] user [${target_user_id}] written Article no(${article_no}), title : (${title}) is already saved. skip this article..`);
        }
    });
}

function add_blacklist(user_id) {
	var statement = db.prepare("INSERT INTO BLACKLIST_USER (USER_ID) VALUES (?)");
	statement.run(user_id);
	statement.finalize();
}

function get_blacklist() {
	return new Promise(function(resolve, reject) {
		var statement = "SELECT USER_ID FROM BLACKLIST_USER ORDER BY ID DESC";
		db.all(statement, function(err, rows) {
			if(err) {
				reject(new Error(err));
			}
			else {
				resolve(rows);
			}
		});
	});
}




function init() {
    createTable();
}
function schedule_go(user_id, password) {
    var j = schedule.scheduleJob('*/1 * * * *', function(){
        console.log("go to work");
        work(user_id, password);
    });
}

function exec() {
	if(process.argv.length  < 4 ) {
		console.log(`USAGE : node filename USER_ID PASSWORD`);
		return;
	}
	let user_id = process.argv[2];
	let password = process.argv[3];
	init();
	schedule_go(user_id, password);
}

exec();

