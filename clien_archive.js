//load libraries..
let cheerio = require('cheerio');
let request = require('request');
let archive = require('archive.is');
let superagent = require('superagent');
let schedule = require('node-schedule');
let sqlite3 = require('sqlite3');
let telegram = require('telegram-bot-api');
var db = new sqlite3.Database('./db/user.db');


//functions start.

function work() {
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

function findAndArchive(target_user_id) {
	CLIEN_URL_PREFIX = "https://www.clien.net";
	request({
		method: 'GET',
        //url: 'https://www.clien.net/service/board/park?sk=id&sv=alf74',
        url: 'https://www.clien.net/service/board/park?sk=id&sv=' + target_user_id,
		timeout: 10000
        }, function(err, response, body) {
			if (err) {
				console.log(`[ERROR_GET_ARTICLES] error occured on processing [${target_user_id}]`);
				console.error(err.code);
			}
			else {
				$ = cheerio.load(body);
				//console.log("==================================================");
				//console.log(`get all article of [${target_user_id}] ..`);
				//console.log("==================================================");
				var post_list = $('div.post-list');
				var items = $('div.item', post_list)
				items.each(function() {
					//article anchor.
					user_id = target_user_id;
					var anchor = $('a.list-subject', this);

					var article_link = CLIEN_URL_PREFIX + anchor.attr('href')
					var title = anchor.text().trim();
					var article_no = anchor.attr('href').split("/")[4].split("?")[0]
					var user_nick = $('a.nick', this).text().trim();
					var timestamp = $('span.timestamp', this).text().trim();
					//console.log(`(${article_no})${title}[${user_nick}] - ${timestamp}`);
					//console.log(article_link);
					checkExistAndSave(target_user_id, user_id, user_nick, article_no, title, article_link, timestamp);
				});
			}
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
			console.log(err);
		}
        else if(rows && rows.length == 0) {
            console.log(`${user_name}(${target_user_id}) [${article_no}] [${title}] is not saved. archive and save this article..`);
            archive.save(url).then(function(result) {
                var shorten = result.shortUrl;
                console.log(`[!NEW!]   user [${target_user_id}] written Article no(${article_no}),  title : (${title}) is now archived(${shorten}). saving this article..`);
                insert(target_user_id, user_id, user_name, article_no, title, url, shorten, created_at);
            });
        }
        else {
            //console.log(`[!EXIST!] user [${target_user_id}] written Article no(${article_no}), title : (${title}) is already saved. skip this article..`);
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
		var statement = "SELECT ID, USER_ID FROM BLACKLIST_USER ORDER BY ID DESC";
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

function get_articles(user_id) {
	return new Promise(function(resolve, reject) {
		var statement = "SELECT * FROM SENT_USER WHERE TARGET_ID = '" + user_id + "' ORDER BY CREATED_AT DESC"; 
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
		date = new Date();
		
        console.log(`${date.toLocaleDateString("ko-KR")} ${date.toLocaleTimeString('ko-KR')} ::: check if exists new article and comment..`);
        work();
    });
}

function exec() {	
	init();
	schedule_go();
}

exec();
