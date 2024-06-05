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
var debug = require('debug')('express-app:app');
var http = require('http');
const axios = require('axios');
const cron = require('node-cron');

const { Viewpoint, Analysis } = require('./models');

require('dotenv').config({ path: path.join(__dirname, '.env') });

var indexRouter = require('./routes/index');
var usersRouter = require('./routes/users');
var fortuneTellRouter = require('./routes/fortuneTell');
var crawlRouter = require('./routes/crawl');
var functionRouter = require('./routes/function');
// var puppetRouter = require('./routes/puppet');
var voiceRouter = require('./routes/voice');
var briefRouter = require('./routes/brief');
var runRouter = require('./routes/run');
var createRouter = require('./routes/create');
var feedRouter = require('./routes/feed');
var screenshotRouter = require('./routes/screenshot');
var chartRouter = require('./routes/chart');
var dominanceRouter = require('./routes/dominance');

var app = express();

console.log('env port: ', process.env.PORT);

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

app.use('/', createRouter);
app.use('/users', usersRouter);
app.use('/fortuneTell', fortuneTellRouter);
app.use('/crawl', crawlRouter);
app.use('/function', functionRouter);
// app.use('/puppet', puppetRouter);
app.use('/voice', voiceRouter);
app.use('/brief', briefRouter);
app.use('/run', runRouter);
app.use('/create', createRouter);
app.use('/feed', feedRouter);
app.use('/screenshot', screenshotRouter);
app.use('/chart', chartRouter);
app.use('/dominance', dominanceRouter);

cron.schedule('0 */4 * * *', async () => {
  console.log('Running a task every four hours');

  // Make an API call
  try {
    const response = await axios.get(`${process.env.API_BASE_URL}/crawl/articles`);
    console.log('API call successful. Data:', response.data);
  } catch (error) {
    console.error('Error making API call:', error);
  }
});

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

function normalizePort(val) {
  var port = parseInt(val, 10);

  if (isNaN(port)) {
    // named pipe
    return val;
  }

  if (port >= 0) {
    // port number
    return port;
  }

  return false;
}


function onError(error) {
  if (error.syscall !== 'listen') {
    throw error;
  }

  var bind = typeof port === 'string'
      ? 'Pipe ' + port
      : 'Port ' + port;

  // handle specific listen errors with friendly messages
  switch (error.code) {
    case 'EACCES':
      console.error(bind + ' requires elevated privileges');
      process.exit(1);
      break;
    case 'EADDRINUSE':
      console.error(bind + ' is already in use');
      process.exit(1);
      break;
    default:
      throw error;
  }
}

function onListening() {
  var addr = server.address();
  var bind = typeof addr === 'string'
      ? 'pipe ' + addr
      : 'port ' + addr.port;
  debug('Listening on ' + bind);
}
var port = normalizePort(process.env.PORT || 3000);
app.set('port', port);
let server = http.createServer(app);

server.listen(port, () => {
  console.log(`server is running on port ${port}`);
  console.log('Cron job scheduled. The process will keep running to execute the scheduled task.')
});
server.on('error', onError);
server.on('listening', onListening);

