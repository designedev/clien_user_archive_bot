//load libraries..
let cheerio = require('cheerio');
let request = require('request');
let archive = require('archive.is');
let superagent = require('superagent');
let schedule = require('node-schedule');
let telegram = require('telegram-bot-api');
let mysql = require('mysql');

let connection = mysql.createConnection({
	host: 'localhost',
	user: 'slave',
	password: '8BMFHfG47S4NHZaw',
	database: 'bot_database'
});

//functions start.

function work() {
	get_blacklist().then(rows => {
				if(rows.length == 0) {
					console.log("there is no blacklist user. exit.");
				}
				else {
					rows.forEach(function(row, index) {
						findAndArchive(row.user_id);
					});
				}
			})
			.catch(err => console.log(err));

}

function findAndArchive(target_user_id) {
	CLIEN_URL_PREFIX = "https://www.clien.net";
	new_request = request.defaults();
	new_request({
		method: 'GET',
        //url: 'https://www.clien.net/service/board/park?sk=id&sv=user_id',
        url: 'https://www.clien.net/service/board/park?sk=id&sv=' + target_user_id,
		timeout: 5000
        }, function(err, response, body) {
			if (err) {
				console.log(`[ERROR_GET_ARTICLES] error occured on processing [${target_user_id}]`);
				console.error(err.code);
			}
			else {
				$ = cheerio.load(body);
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
					checkExistAndSave(target_user_id, user_id, user_nick, article_no, title, article_link, timestamp);
				});
			}
		});
}

function connect_to_db() {
	console.log("=== CONNECT TO DATABASE ===");
	connection.connect(function(error) {
		if(error) {
			console.error('error connecting : ' + err.stack);
		}
		else {
			console.log('CONNECTED SUCCESSFULLY. Thread ID : ' + connection.threadId);
		}	
	});
}

function insert(target_user_id, user_id, user_name, article_no, title, url, shorten, created_at) {
	var article  = {target_user_id: target_user_id, user_id: user_id, user_name: user_name, article_no: article_no, title: title, url: url, shorten: shorten, created_at: created_at};
	var query = connection.query('INSERT INTO clien_user_articles SET ?', article, function (error, results, fields) {
  		if (error) throw error;
	});
}

function checkExistAndSave(target_user_id, user_id, user_name, article_no, title, url, created_at) {
	connection.query("select user_id from clien_user_articles where article_no = " + article_no + " and target_user_id = '" + target_user_id + "'", function(error, results, fields) {
		if(error) {
			console.log(error);
		}
		else if (results && results.length == 0) {
			console.log(`${user_name}(${target_user_id}) [${article_no}] [${title}] is not saved. archive and save this article..`);
			archive.save(url).then(function(result) {
				var shorten = result.shortUrl;
				console.log(`[!NEW!]   user [${target_user_id}] written Article no(${article_no}),  title : (${title}) is now archived(${shorten}). saving this article..`);
				insert(target_user_id, user_id, user_name, article_no, title, url, shorten, created_at);
			});
		}
	});
}

function add_blacklist(user_id) {
	var statement = db.prepare("INSERT INTO clien_watch_users (user_id) VALUES (?)");
	statement.run(user_id);
	statement.finalize();
}

function get_blacklist() {
	return new Promise(function(resolve, reject) {
		connection.query("SELECT id, user_id FROM clien_watch_users ORDER BY ID DESC", function(error, results, fields) {
			if(error) {
				reject(new Error(error));
			}
			else {
				resolve(results);
			}
		});
	});
}

function get_articles(user_id) {
	return new Promise(function(resolve, reject) {
		var statement = "SELECT * FROM clien_user_articles WHERE target_user_id = '" + user_id + "' ORDER BY CREATED_AT DESC"; 
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
	connect_to_db();
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
