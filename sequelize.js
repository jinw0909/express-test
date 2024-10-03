const { Sequelize } = require('sequelize')

let database = process.env.MARIA_DB_DATABASE;
let user = process.env.MARIA_DB_USER;
let password = process.env.MARIA_DB_PASSWORD;
let host = process.env.MARIA_DB_HOST;

const sequelize = new Sequelize(database, user, password, {
    host: host,
    dialect: 'mysql',
    // logging: console.log
    logging: false,
    timezone: '+09:00',
    dialectOptions: {
        timezone: '+09:00',  // This ensures KST is used for both storage and retrieval
    },
});

module.exports = sequelize;