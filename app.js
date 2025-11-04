const express = require('express');
const path = require('path');
const http = require('http');
const debug = require('debug')('express-app:app');
require('dotenv').config({ path: path.join(__dirname, '.env') });
const createError = require('http-errors');
const cors = require('cors');
const cookieParser = require('cookie-parser');
const logger = require('morgan');
const sequelize = require('./sequelize');

const { startCronJobs } = require('./cronJobs');
const { getArticlesDay } = require('./routes/create');

const crawlRouter = require('./routes/crawl').router;
const runRouter = require('./routes/run');
const createRouter = require('./routes/create').router;
// var chartRouter = require('./routes/chart').router;
// const captureRouter = require('./routes/capture').router;
// const deleteRouter = require('./routes/delete');

var app = express();

startCronJobs();
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
app.use('/crawl', crawlRouter);
app.use('/run', runRouter);
app.use('/create', createRouter);
// app.use('/chart', chartRouter);
// app.use('/capture', captureRouter);
// app.use('/delete', deleteRouter);

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
app.get('/articles', async (req, res) => {
  let articles = await getArticlesDay();
  console.log("articles: ", articles);
  res.json(articles);
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
let port = normalizePort(process.env.PORT || 3000);
app.set('port', port);
let server = http.createServer(app);

server.timeout = 1200000; //20 minutes

server.listen(port, () => {
  console.log(`server is running on port ${port}`);
  //console.log('Cron job scheduled. The process will keep running to execute the scheduled task.')
});
server.on('error', onError);
server.on('listening', onListening);

