"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
/*
* This is the logger module using winston package. Redirecting some logs into the standard output (Console).
* Setting up a log level need to be implemented before uses logs.
* Use the #levelMin variable to set up the minimum log level that will be used in the entire program.
* The default value of the log level is 'INFO'.
* Require this module with:
*    import win = require('./lib/logger');
*
* Using examples:
* - win.logger.log('CRITICAL', <text>)      - Higher level of logger, critical error
* - win.logger.log('ERROR', <text>)         - Second level of logger, error
* - win.logger.log('WARNING', <text>)       - Third level of logger, warning message
* - win.logger.log('SUCCESS', <text>)       - 4th level of logger, success message
* - win.logger.log('INFO', <text>)          - 5th level of logger, info message
* - win.logger.log('DEBUG', <text>)         - Lower level of logger, debug mode
*/
const ws = require('winston');
const myCustomLevels = {
    levels: {
        fatal: 0,
        error: 1,
        warn: 2,
        success: 3,
        info: 4,
        debug: 5,
        silly: 6
    },
    colors: {
        fatal: 'red',
        error: 'magenta',
        warn: 'yellow',
        success: 'green',
        info: 'cyan',
        debug: 'blue',
        silly: 'white'
    }
};
// See winston format API at https://github.com/winstonjs/logform
const cLogger = ws.createLogger({
    format: ws.format.combine(ws.format.colorize(), ws.format.timestamp(), ws.format.printf((info) => `[${info.timestamp}] ${info.level}: ${info.message}`)),
    levels: myCustomLevels.levels,
    transports: [new ws.transports.Console()]
});
exports.logger = cLogger;
ws.addColors(myCustomLevels.colors);
function isLogLvl(value) {
    return value === 'debug' || value === 'info' || value === 'success' || value === 'warning'
        || value === 'error' || value === 'critical';
}
function setLogLevel(value) {
    if (!isLogLvl(value))
        throw `Unrecognized logLvel "${value}"`;
    cLogger.level = value;
}
exports.setLogLevel = setLogLevel;
function setLogFile(logFilePath) {
    //winston.remove(fileDefaultTransport);
    let fileCustomTransport = new ws.transports.File({ filename: logFilePath });
    //new winston.transports.File({ filename: 'error.log', level: 'error' })
    cLogger.add(fileCustomTransport);
    //winston.level = logLevel;
}
exports.setLogFile = setLogFile;
