//load libraries..
let sqlite3 = require('sqlite3');
let telegram = require('telegram-bot-api');

var db = new sqlite3.Database('./db/user.db');


function createTable() {
    console.log("initialize db.. create table if not exists..");
    db.run("CREATE TABLE IF NOT EXISTS SENT_USER(ID INTEGER PRIMARY KEY,TARGET_ID TEXT, USER_ID TEXT, USER_NAME TEXT,ARTICLE_NO INTEGER, TITLE TEXT, URL TEXT, SHORTEN TEXT, CREATED_AT DATE)");
	console.log("create blacklist user table if not exist..");
	db.run("CREATE TABLE IF NOT EXISTS BLACKLIST_USER(ID INTEGER PRIMARY KEY, USER_ID TEXT)");
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
