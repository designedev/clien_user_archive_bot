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

function work() {
    cookie_saved_request({
        method: 'POST',
        url: 'https://www.clien.net/cs2/bbs/login_check.php',
        form: {
            mb_id: 'id',
            mb_password: 'password'
        }
    }, function(err, response, body) {
        if(err) {
            console.log(err);
        }
        else {
            console.log(body);
            //console.log(j);
            cookie_saved_request({
                method: 'GET',
                url: 'http://www.clien.net/cs2/bbs/board.php?bo_table=park&sca=&sfl=mb_id%2C1&stx=attack11&x=0&y=0',
                headers: {
                    'Referer': 'http://www.clien.net/cs2/bbs/board.php?bo_table=park&sca=&sfl=mb_id%2C1&stx=attack11&x=0&y=0'
                }
            }, function(err, response, body) {
                if (err) return console.error(err);
                $ = cheerio.load(body);

                $('tr.mytr').each(function() {
                    var subject = $('td.post_subject', this);
                    var title = subject.text();
                    var article_no = $('a', subject).attr('href').split('&')[0].split('≀')[1].split('=')[1];
                    var article_link = `http://www.clien.net/cs2/bbs/board.php?bo_table=park&wr_id=${article_no}`;
                    var user = $('td.post_name a', this).attr('title');
                    var user_id = user.split(']')[0].replace('[','');
                    var user_name = user.split(']')[1];

                    var created_at = $('span',$('td', this).eq(3)).attr('title');
                    // console.log(user_id);
                    // console.log(user_name);
                    // console.log(title);
                    // console.log(article_no);
                    // console.log(article_link);
                    // console.log(created_at);
                    checkExistAndSave(user_id, user_name, article_no, title, article_link, created_at);
                });
            });
        }
    })
}

function createTable() {
    console.log("initialize db.. create table if not exists..");
    db.run("CREATE TABLE IF NOT EXISTS SENT_USER(ID INTEGER PRIMARY KEY, USER_ID TEXT, USER_NAME TEXT,ARTICLE_NO INTEGER, TITLE TEXT, URL TEXT, SHORTEN TEXT, CREATED_AT DATE)");
}

function insert(user_id, user_name, article_no, title, url, shorten, created_at) {
    var statement = db.prepare("INSERT INTO SENT_USER (USER_ID, USER_NAME, ARTICLE_NO, TITLE, URL, SHORTEN, CREATED_AT) VALUES (?, ?, ?, ?, ?, ?, ?)");
    statement.run(user_id, user_name, article_no, title, url, shorten, created_at);
    statement.finalize();
}

function checkExistAndSave(user_id, user_name, article_no, title, url, created_at) {
    var preparedStmt = "SELECT USER_ID FROM SENT_USER WHERE ARTICLE_NO = " + article_no;
    db.all(preparedStmt, function(err, rows) {
        if(rows.length == 0) {
            console.log(`Article no(${article_no} is not saved. archive and save this article..`);
            archive.save(url).then(function(result) {
                var shorten = result.shortUrl;
                console.log(`Article no(${article_no} is now archived(${shorten}). saving this article..`);
                insert(user_id, user_name, article_no, title, url, shorten, created_at);
            });
        }
        else {
            console.log(`Article no(${article_no} is already saved. skip this article..`);
        }
    });
}

function init() {
    createTable();
}
function schedule_go() {
    var j = schedule.scheduleJob('*/1 * * * *', function(){
        console.log("go to work");
        work();
    });
}

init();
schedule_go();