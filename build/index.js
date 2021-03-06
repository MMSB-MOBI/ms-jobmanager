"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.push = exports.start = exports.eLiveMemory = void 0;
const fs = require("fs"); // file system
const events = require("events");
const net = require("net");
const path = require("path");
const util = require("util");
const uuidv4 = require("uuid/v4");
//import date = require('date-and-time');
const logger_js_1 = require("./logger.js");
const jobLib = require("./job");
const engineLib = require("./lib/engine/index.js");
const cType = require("./commonTypes.js");
const jmServer = require("./nativeJS/job-manager-server.js");
//import _ = require('./nativeJS/job-manager-client.js');
const liveMemory = require("./lib/pool.js");
const clientWH = require("ms-warehouse");
clientWH.setLogger(logger_js_1.logger);
function eLiveMemory() { return liveMemory; }
exports.eLiveMemory = eLiveMemory;
;
//let search:warehouse.warehousSearchInterface;
let engine; // to type with Engine contract function signature
let microEngine = new engineLib.dummyEngine(); // dummy engine used by jobProxy instance
// Address of the jobManager MicroService
let TCPip = '127.0.0.1';
// Port for communication w/ node workers
let TCPport = 2222;
// Port for consumer microServices
let proxyPort = 8080;
// Address of the Warehouse MicroService
let addressWH = '127.0.0.1';
// Port for communication w/ Warehouse
let portWH = 7688;
let scheduler_id = uuidv4();
let dataLength = 0;
// Intervall for periodic operations
let corePulse = null;
let core;
// Intervall for periodic monitoring
let wardenPulse = 5000;
let warden;
var cacheDir = null;
let nWorker = 10; // running job max poolsize
let eventEmitter = new events.EventEmitter();
let exhaustBool = false; // set to true at any push, set to false at exhausted event raise
let emulator = false; // Trying to keep api/events intact while running job as fork on local
let isStarted = false;
let microServiceSocket = undefined;
let schedulerID = uuidv4();
//VR change typeguard to warehouse
function isSpecs(opt) {
    //logger.debug('???');
    //logger.debug(`${opt.cacheDir}`);
    //let b:any = opt.cacheDir instanceof(String)
    if (!path.isAbsolute(opt.cacheDir)) {
        logger_js_1.logger.error('cacheDir parameter must be an absolute path');
        return false;
    }
    if (opt.engineBinaries) {
        logger_js_1.logger.debug("Testing specified engineBinaries");
        if (!engineLib.isBinariesSpec(opt.engineBinaries)) {
            logger_js_1.logger.error(`Wrong binariesSpec\n ${util.inspect(opt.engineBinaries)}`);
            return false;
        }
    }
    if ('cacheDir' in opt && 'tcp' in opt && 'port' in opt && 'engineSpec' in opt) {
        return typeof (opt.cacheDir) == 'string' && typeof (opt.tcp) == 'string' &&
            typeof (opt.port) == 'number' && engineLib.isEngineSpec(opt.engineSpec);
    }
    //logger.debug('niet');
    return false;
}
function _openSocket(port) {
    let eventEmitterSocket = new events.EventEmitter();
    //var data = '';
    let server = net.createServer(function (socket) {
        socket.write('#####jobManager scheduler socket####\r\n');
        socket.pipe(socket);
        socket.on('data', function (buf) {
            //console.log("incoming data");
            //console.log(buf.toString());
            eventEmitterSocket.emit('data', buf.toString());
        })
            .on('error', function () {
            // callback must be specified to trigger close event
        });
    });
    server.listen(port); //, "127.0.0.1"
    server.on('error', function (e) {
        console.log('error' + e);
        eventEmitter.emit('error', e);
    });
    server.on('listening', function () {
        logger_js_1.logger.debug('Listening on ' + port + '...');
        eventEmitterSocket.emit('listening');
    });
    server.on('connection', function (s) {
        //console.log('connection w/ ' + data);
        s.on('close', function () {
            //  console.log('Packet connexion closed');
        });
        //console.dir(s);
        //ntEmitter.emit('success', server);
    });
    return eventEmitterSocket;
}
function _pulse() {
    let c = liveMemory.size();
    if (c === 0) {
        if (exhaustBool) {
            eventEmitter.emit("exhausted");
            exhaustBool = false;
        }
    }
}
//CH 02/12/19
// Maybe use promess instead of emit("ready"), emit("error")
function start(opt) {
    logger_js_1.logger.debug(`${util.format(opt)}`);
    if (isStarted) {
        let t = setTimeout(() => { eventEmitter.emit("ready"); }, 50);
        return eventEmitter;
    }
    if (!isSpecs(opt)) {
        let msg = `Missing or wrong type arguments : engine, cacheDir, opt, tcp, binariesSpec (in conf file)`;
        //eventEmitter.emit("error", msg)
        let t = setTimeout(() => { eventEmitter.emit("error", msg); }, 50);
        return eventEmitter;
    }
    engine = engineLib.getEngine(opt.engineSpec, opt.engineBinaries);
    emulator = opt.engineSpec == 'emulate' ? true : false;
    if (opt.tcp)
        TCPip = opt.tcp;
    if (opt.port)
        TCPport = opt.port;
    // if a port is provided for microservice we open connection
    if (opt.microServicePort) {
        microServiceSocket = jmServer.listen(opt.microServicePort);
        logger_js_1.logger.debug(`Listening for consumer microservices at : ${opt.microServicePort}`);
        microServiceSocket.on('newJobSocket', pushMS);
        microServiceSocket.on('connection', () => {
            logger_js_1.logger.debug('Connection on microservice consumer socket');
        });
    }
    if (opt.nWorker)
        nWorker = opt.nWorker;
    if (opt.cycleLength)
        wardenPulse = parseInt(opt.cycleLength);
    if (opt.warehouseAddress)
        addressWH = opt.warehouseAddress;
    if (opt.warehousePort)
        portWH = opt.warehousePort;
    if (opt.warehouseTest && opt.warehouseTest === true)
        clientWH.handshake({
            warehouseAddress: opt.warehouseAddress,
            portSocket: opt.warehousePort
        }).then(() => { })
            .catch(() => { });
    // cacheDir managment
    cacheDir = opt.forceCache ? opt.cacheDir : opt.cacheDir + '/' + scheduler_id;
    if (opt.forceCache) {
        logger_js_1.logger.info("Checking force cache access");
        if (!fs.existsSync(cacheDir)) {
            logger_js_1.logger.console.error(`cacheDir ${cacheDir} is invalid path`);
            throw ('cacheDir error');
        }
    }
    else {
        logger_js_1.logger.debug("Attempting to create cache for process at " + cacheDir);
        try {
            fs.mkdirSync(cacheDir);
        }
        catch (e) {
            if (e.code != 'EEXIST') {
                logger_js_1.logger.error(`Can't create cache folder reason:\n${e}}`);
                throw e;
            }
            logger_js_1.logger.error("Cache found already found at " + cacheDir);
        }
    }
    logger_js_1.logger.debug('[' + TCPip + '] opening socket at port ' + TCPport);
    let s = _openSocket(TCPport);
    let data = '';
    s.on('listening', function (socket) {
        isStarted = true;
        logger_js_1.logger.debug("Starting pulse monitoring");
        logger_js_1.logger.debug("cache Directory is " + cacheDir);
        core = setInterval(function () {
            _pulse();
        }, 500);
        warden = setInterval(function () {
            jobWarden();
        }, wardenPulse);
        logger_js_1.logger.info(`-==JobManager successfully started==-
scheduler_id : ${scheduler_id}
engine type : ${engine.specs}
internal ip/port : ${TCPip}/${TCPport}
consumer port : ${opt.microServicePort}
worker pool size : ${nWorker}
cache directory : ${cacheDir}
[DEFAULT BINARIES]
submit binary : ${engine.submitBin}
queue binary : ${engine.queueBin ? engine.queueBin : "No one"}
cancel binary : ${engine.cancelBin ? engine.cancelBin : "No one"}
`);
        eventEmitter.emit("ready");
    })
        .on('data', _parseMessage);
    return eventEmitter;
}
exports.start = start;
function wardenKick(msg, error, job) {
    logger_js_1.logger.silly('wardenKick');
    liveMemory.removeJob({ jobObject: job });
    job.socket.emit('fsFatalError', msg, error, job.id);
}
function jobWarden() {
    logger_js_1.logger.silly("jobWarden");
    logger_js_1.logger.debug(`liveMemory size = ${liveMemory.size()}`);
    engine.list().on('data', function (d) {
        logger_js_1.logger.silly(`${util.format(d)}`);
        for (let job of liveMemory.startedJobiterator()) {
            let jobSel = { jobObject: job };
            if (d.nameUUID.indexOf(job.id) === -1) { // if key is not found in listed jobs
                job.MIA_jokers -= 1;
                logger_js_1.logger.warn(`The job ${job.id} missing from queue! Jokers left is ${job.MIA_jokers}`);
                if (job.MIA_jokers === 0) {
                    //var jobTmp = clone(curr_job); // deepcopy of the disappeared job
                    //jobTmp.obj.emitter = curr_job.obj.emitter; // keep same emitter reference
                    let tmpJob = job;
                    liveMemory.removeJob(jobSel);
                    if (liveMemory.size("notBound") < nWorker)
                        jmServer.openBar();
                    logger_js_1.logger.error(`job ${job.id} definitively lost`);
                    tmpJob.jEmit('lostJob', tmpJob);
                }
            }
            else {
                if (job.MIA_jokers < 3)
                    logger_js_1.logger.info(`Job ${job.id} found BACK ! Jokers count restored`);
                job.MIA_jokers = 3;
                liveMemory.setCycle(jobSel, '++');
                ttlTest(job);
            }
        }
        //emitter.emit('');
    }).on('listError', function (err) {
        eventEmitter.emit("wardenError", err);
    });
    //    return emitter;
}
function ttlTest(job) {
    if (!job.ttl)
        return;
    let jobSel = { jobObject: job };
    let nCycle = liveMemory.getCycle(jobSel);
    if (typeof nCycle === 'undefined') {
        logger_js_1.logger.error("TTL ncycle error");
        return;
    }
    var elaspedTime = wardenPulse * nCycle;
    logger_js_1.logger.warn(`Job is running for ~ ${elaspedTime} ms [ttl is : ${job.ttl}]`);
    if (elaspedTime > job.ttl) {
        logger_js_1.logger.warn(`TTL exceeded for Job ${job.id} attempting to terminate it`);
        engine.kill([job]).on('cleanExit', function () {
            job.jEmit('killed');
            //eventEmitter.emit("killedJob", job.id);
            liveMemory.removeJob(jobSel);
            if (liveMemory.size() < nWorker)
                jmServer.openBar();
        }); // Emiter is passed here if needed
    }
}
/*
    TypeGuard for job parameters passed to the push function
*/
function _checkJobBean(obj) {
    if (!cType.isStringMapOpt(obj)) {
        logger_js_1.logger.error("unproper job parameter (not a string map)");
        return false;
    }
    if (!obj.hasOwnProperty('cmd') && !obj.hasOwnProperty('script')) {
        logger_js_1.logger.error("unproper job parameters (no script nor cmd)");
        return false;
    }
    if (obj.hasOwnProperty('cmd')) {
        if (!obj.cmd) {
            logger_js_1.logger.error("unproper job parameters (undefined cmd)");
            return false;
        }
    }
    else {
        if (!obj.script) {
            logger_js_1.logger.error("unproper job parameters (undefined script)");
            return false;
        }
    }
    return true;
}
// New job packet arrived on MS socket, 1st arg is streamMap, 2nd the socket
function pushMS(data, socket) {
    logger_js_1.logger.debug(`newJob Packet arrived w/ ${util.format(data)}`);
    logger_js_1.logger.silly(` Memory size vs nWorker :: ${liveMemory.size()} <<>> ${nWorker}`);
    if (liveMemory.size("notBound") >= nWorker) {
        logger_js_1.logger.debug("must refuse packet, max pool size reached");
        jmServer.bouncer(data, socket);
        return;
        // No early exit yet
    }
    jmServer.granted(data, socket).then((_data) => {
        let jobProfile = _data.jobProfile;
        _data.fromConsumerMS = true;
        //pool size
        if (jobLib.isJobOptProxy(_data)) {
            logger_js_1.logger.debug(`jobOpt successfully decoded`);
        }
        let job = push(jobProfile, _data);
    });
}
/* weak typing of the jobOpt  parameter */
function push(jobProfileString, jobOpt /*jobOptInterface*/, namespace) {
    logger_js_1.logger.debug(`Following litteral was pushed \n ${util.format(jobOpt)}`);
    let jobID = uuidv4();
    if (jobOpt.hasOwnProperty('id'))
        if (jobOpt.id)
            jobID = jobOpt.id;
    //Default job working directory maybe redifiedn later
    let workDir = cacheDir + '/' + jobID;
    /* Building a jobOptInterface litteral out of the jobOpt function parameter */
    let jobTemplate = {
        // "engineHeader": engine.generateHeader(jobID, jobProfileString, workDir),
        "engine": engine,
        "workDir": workDir,
        "emulated": emulator ? true : false,
        "adress": TCPip,
        "port": TCPport,
        "jobProfile": jobProfileString ? jobProfileString : "default"
        // "submitBin": engine.submitBin(),
    };
    if ('exportVar' in jobOpt)
        jobTemplate.exportVar = jobOpt.exportVar;
    if ('modules' in jobOpt)
        jobTemplate.modules = jobOpt.modules;
    if ('script' in jobOpt)
        jobTemplate.script = jobOpt.script;
    if ('cmd' in jobOpt)
        jobTemplate.cmd = jobOpt.cmd;
    if ('inputs' in jobOpt)
        jobTemplate.inputs = jobOpt.inputs;
    if ('tagTask' in jobOpt)
        jobTemplate.tagTask = jobOpt.tagTask;
    if ('ttl' in jobOpt)
        jobTemplate.ttl = jobOpt.ttl;
    if ('socket' in jobOpt)
        jobTemplate.socket = jobOpt.socket;
    if ('sysSettingsKey' in jobOpt)
        jobTemplate.sysSettingsKey = jobOpt.sysSettingsKey;
    logger_js_1.logger.debug(`Following jobTemplate was successfully buildt \n ${util.format(jobTemplate)}`);
    let newJob = new jobLib.jobObject(jobTemplate, jobID);
    // All engine parameters are set at this stage, working on folder creations should be safe
    // Check for intermediary folders in workdirpath
    // rootCache /job.iCache??""/ namespace ??"" / jobID
    if (namespace || newJob.engine.iCache) {
        newJob.workDir = cacheDir ? `${cacheDir}/` : "";
        newJob.workDir += newJob.engine.iCache ? `${newJob.engine.iCache}/` : "";
        newJob.workDir += namespace ? `${namespace}/` : "";
        newJob.workDir += jobID;
        logger_js_1.logger.debug(`Redefined job workDir ${newJob.workDir}`);
    }
    /*
    if (namespace) {
        try { fs.mkdirSync(cacheDir + '/' + namespace); }
        catch (err) {
            if (err.code != 'EEXIST') {
                logger.error("Namespace " + cacheDir + '/' + namespace + ' already exists.');
                throw err;
            }
        }
        workDir = cacheDir + '/' + namespace + '/' + jobID;
    } else {
        workDir = cacheDir + '/' + jobID;
    }
    */
    if ('fromConsumerMS' in jobOpt)
        newJob.fromConsumerMS = jobOpt.fromConsumerMS;
    // 3 outcomes
    // newJob.launch // genuine start
    // newJob.resurrect // load from wareHouse a complete job
    // newJob.melt // replace newJob by an already running job
    //                just copying client socket if fromConsumerMS 
    //
    logger_js_1.logger.debug(`Following jobObject was successfully buildt \n ${util.format(newJob)}`);
    newJob.start();
    liveMemory.addJob(newJob);
    let fatal_error = ["folderCreationError", "folderSetPermissionError"];
    fatal_error.forEach((symbol) => {
        newJob.on(symbol, wardenKick);
    });
    newJob.on('submitted', function (j) {
        liveMemory.jobSet('SUBMITTED', { jobObject: newJob });
        //jobsArray[j.id].status = 'SUBMITTED';
    });
    newJob.on('inputSet', function () {
        // All input streams were dumped to file(s), we can safely serialize
        let jobSerial = newJob.getSerialIdentity();
        MS_lookup(jobSerial)
            .on('known', function (fStdoutName, fStderrName, workPath) {
            newJob.respawn(fStdoutName, fStderrName, workPath);
            newJob.jEmit("completed", newJob);
            // Repertoir valide
            // Extraire la sortie d'erreur / standard du job et faire lever levent completed
            //logger.info("I CAN RESURRECT YOU : " + validWorkFolder + ' -> ' + jobTemplate.tagTask);
            //_resurrect(newJob, validWorkFolder);
        })
            .on('unknown', function () {
            logger_js_1.logger.debug("####No suitable job found in warehouse");
            let previousJobs;
            previousJobs = liveMemory.lookup(newJob);
            if (previousJobs) {
                // let refererJob:jobLib.jobObject = getJob(previousJobs[0].id];
                logger_js_1.logger.debug(`${previousJobs.length} suitable living job(s) found, shimmering`);
                melting(previousJobs[0], newJob);
                return;
            }
            logger_js_1.logger.debug('No Suitable living jobs found, launching');
            //liveStore(newJob.getSerialIdentity());  
            //jobRegister(newJob);
            liveMemory.jobSet('source', { jobObject: newJob });
            newJob.launch();
            newJob.on('jobStart', function (job) {
                engine.list();
                // shall we call dropJob function here ?
                // CH/GL 02/12/19
                //We should check for liveMemory management and client socket event propagation. 
            }).on('scriptReadError', function (err, job) {
                logger_js_1.logger.error(`ERROR while reading the script : \n ${err}`);
            }).on('scriptWriteError', function (err, job) {
                logger_js_1.logger.error(`ERROR while writing the coreScript : \n ${err}`);
            }).on('scriptSetPermissionError', function (err, job) {
                logger_js_1.logger.error(`ERROR while trying to set permissions of the coreScript : \n ${err}`);
            });
        });
    });
    exhaustBool = true;
    //console.log(jobsArray);
    return newJob;
}
exports.push = push;
/*
    Add the socket
*/
function melting(previousJobs, newJob) {
    // Local melting
    newJob.isShimmeringOf = previousJobs;
    previousJobs.hasShimmerings.push(newJob);
    // consumer view melting
}
/*
    always lookin warehouse first, if negative look in jobsArray

    case1) warehouse/-, jobsArray/-              => submit
    case2) warehouse/+, dont look at jobsArray   => resurrect
    case3) warehouse/-, jobsArray/+              => copy jobReference and return it

*/
function MS_lookup(jobTemplate) {
    let emitter = new events.EventEmitter();
    let jobConstraints = {
        "exportVar": jobTemplate.exportVar,
        "scriptHash": jobTemplate.scriptHash,
        "inputHash": jobTemplate.inputHash
    };
    let param = {
        warehouseAddress: addressWH,
        portSocket: portWH
    };
    clientWH.pushConstraints(jobConstraints).on('foundDocs', (nameOut, nameErr, workPath) => {
        emitter.emit("known", nameOut, nameErr, workPath);
    })
        .on('notFoundDocs', () => {
        emitter.emit("unknown");
    })
        .on('cantConnect', () => {
        emitter.emit("unknown");
    });
    return emitter;
}
function _parseMessage(msg) {
    //console.log("trying to parse " + string);
    let re = /^JOB_STATUS[\s]+([\S]+)[\s]+([\S]+)/;
    let matches = msg.match(re);
    if (!matches)
        return;
    let jid = matches[1];
    let uStatus = matches[2];
    let jobSel = { 'jid': jid };
    //  liveMemory.getJob({ 'jid' : jid });
    if (!liveMemory.getJob(jobSel)) {
        logger_js_1.logger.warn(`unregistred job id ${jid}`);
        eventEmitter.emit('unregistredJob', jid);
        return;
        //throw 'unregistred job id ' + jid;
    }
    logger_js_1.logger.debug(`Status Updating job ${jid} : from
\'${liveMemory.getJobStatus(jobSel)} \' to \'${uStatus}\'`);
    liveMemory.jobSet(uStatus, jobSel);
    let job = liveMemory.getJob(jobSel);
    if (job) {
        if (uStatus === 'START') {
            job.jEmit('jobStart', job);
            logger_js_1.logger.debug("parsing Message ==> emit jobStart");
        }
        else if (uStatus === "FINISHED") {
            logger_js_1.logger.debug("parsing Message ==> FINISHED && pullin");
            _pull(job); //TO DO
        }
        //logger.error(`TO DO`);
    }
}
/*
    handling job termination.
    Eventualluy resubmit job if error found

*/
function _pull(job) {
    logger_js_1.logger.silly(`Pulling ${job.id}`);
    job.stderr().then((streamError) => {
        let stderrString = null;
        streamError.on('data', function (datum) {
            stderrString = stderrString ? stderrString + datum.toString() : datum.toString();
        })
            .on('end', function () {
            if (!stderrString) {
                _storeAndEmit(job.id);
                return;
            }
            logger_js_1.logger.warn(`Job ${job.id} delivered the following non empty stderr stream\n${stderrString}`);
            job.ERR_jokers--;
            if (job.ERR_jokers > 0) {
                logger_js_1.logger.warn(`Resubmitting the job ${job.id} : ${job.ERR_jokers} try left`);
                job.resubmit();
                liveMemory.setCycle({ jobObject: job }, 0);
            }
            else {
                logger_js_1.logger.warn(`The job ${job.id} will be set in error state`);
                _storeAndEmit(job.id, 'error');
            }
        });
    });
}
;
/*
 We treat error state emission / document it for calling scope
 // MAybe use jobObject as 1st parameter?
*/
function _storeAndEmit(jid, status) {
    let jobSel = { 'jid': jid };
    logger_js_1.logger.debug("Store&Emit");
    let jobObj = liveMemory.getJob(jobSel);
    if (jobObj) {
        liveMemory.removeJob(jobSel);
        if (liveMemory.size("notBound") < nWorker)
            jmServer.openBar();
        jobObj.jEmit("completed", jobObj);
        let serialJob = jobObj.getSerialIdentity();
        // add type 
        // Make some tests on the jobFootPrint literal?
        clientWH.storeJob(serialJob).on('addSuccess', (message) => {
            logger_js_1.logger.log('success', `Job footprint stored in Warehouse`);
        });
        //warehouse.store(jobObj); // Only if genuine
    }
    else {
        logger_js_1.logger.error('Error storing job is missing from pool');
    }
}
