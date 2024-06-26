import jobManagerCore = require('../index.js');
import {logger, setLogLevel, setLogFile} from '../logger.js';
const { program } = require('commander');
//import {selfTest} from '../tests_to_update/testTools';

/*
    Launching the job manager microservice
*/
program
    .version('0.1.0')
    .option('-e, --engine [engine name]', 'MS Job Manager engine')  
    .option('-p, --port <n>', 'MS Job Manager internal/main port', parseInt)
    .option('-k, --socket <n>', 'MS Job Manager subscriber port', parseInt)
    .option('-v, --verbosity [logLevel]', 'Set log level', setLogLevel, 'info')
    .option('-d, --delay <n>', 'delay between test', parseInt)
    .option('-c, --cache [cacheDir]', 'cache directory', './')
    .option('-s, --self <n>', 'Microservice Self testing, by launching n consecutive jobs', parseInt)
    .option('-w, --warehouse [address]', 'Warehouse address', '127.0.0.1')
    .option('-x, --whport <n>', 'Warehouse port', parseInt)
    .option('-n, --nworker <n>', 'Maximum number of workers')
    .option('-o, --logFile [filePath]', 'Set log file location', setLogFile)
    //.option('-b, --bean [configurationFilePath]', 'MS Job Manager configuration File') /* Does not seem to be used ? */
    .option('-f, --force', 'Enforce cacheDir usage, preventing root cache folder creation', false) /* Does not seem to be used */
    .option('-t, --whtest', 'Warehouse connection test') /* Does not seem to be used */
    .option('-a, --adress [IP adress]', 'MS Job Manager host machine adress', '127.0.0.1');  /*Does not seem to be used */
//.parse(process.argv);
program.parse();
const options = program.opts();

if (!program.logFile)
    setLogFile('./jobManager.log');

logger.info("\t\tStarting public JobManager MicroService");

let baseParameters = {
    cacheDir : options.cache,
    engineSpec : options.engine, //as jobManagerCore.engineSpecs,
    tcp : options.adress,
    port : options.port ? options.port : 8080,
    microServicePort:options.socket ? options.socket : 2020,
    warehouseAddress: options.warehouse,
    warehousePort: options.whport ? options.whport : 7688,
    warehouseTest: options.whtest ? true : false,
    nWorker : options.nworker ? options.nworker : 10,
    engineBinaries : options.bean ? options.bean : undefined, //JSON.parse(fs.readFileSync(program.bean, 'utf8')).engineBinaries
    forceCache : options.force
};

if(options.self) {
    logger.info(`Performing ${program.self} self test, MS capabilities are disabled`);
    baseParameters.microServicePort = undefined;
}

if (!baseParameters.engineBinaries){ //program.bean
    logger.warn("no engineBinaries specified in configuration file. Default will be use.")
}

jobManagerCore.start(baseParameters).on('ready', () => {
    if(program.self)
        logger.warn("Tests need to be updated...")    
    //selfTest(jobManagerCore, program.self);
}).on('error', (msg) => {
    logger.fatal(msg)
});
