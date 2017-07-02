//load libraries..
let cheerio = require('cheerio');
let request = require('request');
let archive = require('archive.is');
let superagent = require('superagent');
let schedule = require('node-schedule');
let sqlite3 = require('sqlite3');

let telegram = require('telegram-bot-api');

//set request to save cookies.
var db = new sqlite3.Database('./db/user.db');
//var j = request.jar()
var cookie_saved_request = null; //request.defaults({jar:j})


//functions start.

function work(user_id, password) {
	var j = request.jar()
	cookie_saved_request = request.defaults({jar:j})

    cookie_saved_request({
        method: 'POST',
        url: 'https://www.clien.net/cs2/bbs/login_check.php',
		timeout: 10000,
        form: {
            mb_id: user_id,
            mb_password: password
        }
    }, function(err, response, body) {
        if(err) {
			console.log(`[ERROR_ON_LOGIN] error occured on processing [${user_id}]`);
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
		timeout: 10000,
        headers: {
        	'Referer': 'http://www.clien.net/cs2/bbs/board.php?bo_table=park&sca=&sfl=mb_id%2C1&stx=' + target_user_id + '&x=0&y=0'
        		}
        }, function(err, response, body) {
			if (err) {
				console.log(`[ERROR_GET_ARTICLES] error occured on processing [${target_user_id}]`);
				console.error(err.code);
			}
			else {
				$ = cheerio.load(body);
				//console.log("==================================================");
				console.log(`get all article of [${target_user_id}] ..`);
				//console.log("==================================================");
				$('tr.mytr').each(function() {
					var subject = $('td.post_subject', this);
           	     var title = subject.text();
					if(title.startsWith('-차단하신')) {
						// do nothing...  console.log("!!!!! IGNORED ARTICLE. PASS !!!!!");
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
            //console.log(`[no : ${article_no}], [title : ${title}] is not saved. archive and save this article..`);
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
        console.log("check if exists new article and comment..");
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


/*
let api = new telegram({
	token: '361484413:AAHO-eYWP8QlVr-FBarsd6aefsNwLNHxNhw',
	updates: {enabled: true}
});


api.on('message', function(message) {
	//send_message(message.chat.id, message.text);
	if(message.text) {

		if(message.text.startsWith('추가')) {
			telegram_add_blacklist(message);	
		}
		else if (message.text.startsWith('삭제')) {
			telegram_delete_blacklist(message);
		}
		else if (message.text.startsWith('목록')) {
			telegram_get_blacklist(message);
		}
		else if (message.text.startsWith('검색')) {
			telegram_get_articles(message);
		}
		else {
			send_message(message.chat.id, `추가,삭제,목록,검색 가능`);
		}
	}	
});

*/

function telegram_add_blacklist(message) {
	let message_array = message.text.split(' ');
	if(message_array.length > 1) {
		var statement = db.prepare("INSERT INTO BLACKLIST_USER (USER_ID) VALUES (?)");
		statement.run(message_array[1]);
		statement.finalize(send_message(message.chat.id, `${message_array[1]} 사용자 추가 완료.`));
	}
}

function telegram_delete_blacklist(message) {
	let message_array = message.text.split(' ');
	if(message_array.length > 1) {
		var statement = db.prepare("DELETE FROM BLACKLIST_USER WHERE ID = ?");
		statement.run(message_array[1]);
		statement.finalize(send_message(message.chat.id, `${message_array[1]} 사용자 삭제 완료.`));
	}

}

function telegram_get_blacklist(message) {
	get_blacklist().then(rows => {
		let text = '';
		rows.forEach(function(row, index) {
			text += row.ID + '  -  ' + row.USER_ID + '\n';
		})
		send_message(message.chat.id, text);
	});


}

function telegram_get_articles(message) {
	let message_array = message.text.split(' ');
	if(message_array.length > 1) {
		get_articles(message_array[1]).then(rows => {
			let text = '';
			let comment_count = 0;
			let article_count = 0;
			

			rows.forEach(function (row) {
				if(row.USER_ID === row.TARGET_ID) {
					article_count++;
				}
				else {
					comment_count++;
				}
			});

			send_message(message.chat.id, `USER ID : ${message_array[1]} \narticle : ${article_count} \ncomment : ${comment_count}`);

			/*
				SPLICE AND SEND MESSAGE EACH.
			*/

			let arrays = [];
			let eachSize = 20;
			while(rows.length  > 0 ) {
				arrays.push(rows.splice(0, eachSize));
			}

			arrays.forEach(function(item) {
				item.forEach(function(row, index) {
					if(row.USER_ID === row.TARGET_ID) {
						text += '[A] ' + row.TITLE + '(' + row.SHORTEN + ')\n';
					}
					else {
						text += '[C] ' +  row.TITLE + '(' + row.SHORTEN + ')\n';
					}
				});
				send_message(message.chat.id, text);
			});

		});
	}
}

function send_message(chat_id, message) {
	api.sendMessage({
		chat_id: chat_id,
		text: message
	}).then(function(msg) {
		//do nothing..
	}, function(error) {
		//do nothing for now.
	});
}
