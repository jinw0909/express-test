var createError = require('http-errors');
var express = require('express');
var cors = require('cors');
var path = require('path');
var cookieParser = require('cookie-parser');
var logger = require('morgan');
const multer = require('multer');
const AWS = require('aws-sdk');
const db = require('./database');
const sequelize = require('./sequelize');
const Coinness = require('./coinness');

require('dotenv').config({ path: path.join(__dirname, '.env') });

var indexRouter = require('./routes/index');
var usersRouter = require('./routes/users');
var fortuneTellRouter = require('./routes/fortuneTell');
var crawlRouter = require('./routes/crawl');
var functionRouter = require('./routes/function');
var puppetRouter = require('./routes/puppet');
var voiceRouter = require('./routes/voice');
var briefRouter = require('./routes/brief');
var runRouter = require('./routes/run');

var app = express();



(async () => {
  try {
    await sequelize.sync();
    console.log('Database synchronized successfully');
  } catch (error) {
    console.error('Error synchronizing database:', error);
  }
})();


// view engine setup
app.set('views', path.join(__dirname, 'views'));
app.set('view engine', 'ejs');

app.use(cors());

app.use(logger('dev'));
app.use(express.json());
app.use(express.urlencoded({ extended: false }));
app.use(cookieParser());
app.use(express.static(path.join(__dirname, 'public')));

app.use('/', indexRouter);
app.use('/users', usersRouter);
app.use('/fortuneTell', fortuneTellRouter);
app.use('/crawl', crawlRouter);
app.use('/function', functionRouter);
app.use('/puppet', puppetRouter);
app.use('/voice', voiceRouter);
app.use('/brief', briefRouter);
app.use('/run', runRouter);
app.get('/createdb', (req, res) => {
  let sql = 'CREATE DATABASE testdb';
  db.query(sql, (err, result) => {
    if (err) throw err;
    res.send('Database created');
    console.log(result);
  });
})
// catch 404 and forward to error handler
app.use(function(req, res, next) {
  next(createError(404));
});

// error handler
app.use(function(err, req, res, next) {
  // set locals, only providing error in development
  res.locals.message = err.message;
  res.locals.error = req.app.get('env') === 'development' ? err : {};

  // render the error page
  res.status(err.status || 500);
  res.render('error');
});

module.exports = app;
