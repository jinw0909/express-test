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
var handleimgRouter = require('./routes/handleimg');
var healthcheckRouter = require('./routes/healthcheck');
var captureRouter = require('./routes/capture').router;
var plainRouter = require('./routes/plain');
var selfRouter = require('./routes/self');

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
app.use('/handleimg', handleimgRouter);
app.use('/healthcheck', healthcheckRouter);
app.use('/capture', captureRouter);
app.use('/plain', plainRouter);
app.use('/self', selfRouter);

app.post('/', (req, res) => {
  const payload = req.body;
  console.log('Received POST request:', JSON.stringify(payload, null, 2));

  // Validate payload structure
  if (!payload || !payload.Records || !Array.isArray(payload.Records) || !payload.Records[0].body) {
    console.error('Validation error: Invalid payload structure', JSON.stringify(payload, null, 2));
    return res.status(400).json({ error: 'Invalid payload structure' });
  }

  // Parse the body if it's JSON string
  let messageBody;
  try {
    messageBody = JSON.parse(payload.Records[0].body);
  } catch (error) {
    console.error('Error parsing message body:', error);
    return res.status(400).json({ error: 'Invalid message body format' });
  }

  // Further validation on message body
  if (!messageBody.Message || !messageBody.Message.ApplicationReference || !messageBody.Message.Function || !functions[messageBody.Message.Function]) {
    console.error('Validation error: Missing required fields or unknown function', JSON.stringify(messageBody, null, 2));
    return res.status(400).json({ error: 'Missing required fields or unknown function' });
  }

  try {
    // Invoke the specified function with parameters
    const functionName = messageBody.Message.Function;
    const functionParams = messageBody.Message.Parameters || {};
    functions[functionName](functionParams);

    console.log('Processing message:', messageBody.Message.ApplicationReference);
    res.status(200).json({ message: 'Request processed successfully' });
  } catch (error) {
    console.error('Processing error:', error, JSON.stringify(payload, null, 2));
    res.status(500).json({ error: 'Internal server error' });
  }
});

const functions = {
  processData: (params) => {
    console.log('Processing data with params:', params);
    // Your function logic here
  },
  // Add other functions as needed
};


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
  //console.log('Cron job scheduled. The process will keep running to execute the scheduled task.')
});
server.on('error', onError);
server.on('listening', onListening);

