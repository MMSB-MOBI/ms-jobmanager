# MOBI JobManager
## June2022 @ZEN release

![alt text](./assets/ryoanji.png "Have a seat & relax")

## Have a seat and relax

Ths jobmanager ecosystem allows for the submission of SHELL script or commands from a client JavaScript runtime to a remote server JavaScript program. The server handles to scheduling of jobs by converting them to POSIX threads or by passing them to a SLURM process. The client exposes a simple push API with asynchronous access to the results of the job. Under the hood, client/server communication uses the stream socket-io API.
Additional execution environments for the server instance can be added by simply implementing engine contract.

A typical client environment can be an express server or a nest application (see:// nest application repo).

### Installation

```sh
npm install ms-jobmanager
```

### Client-side
You just need to import the client library.

```javascript
import jmClient from 'ms-jobmanager'
```

It will provide you with a NodeJS Singleton client object.

#### Connect to a server instance
As a first step, we will just load the library and try to connect with a running server instance.
For initial connection puroposes, the client API exposes the Promise-resolved `start` function.



jmClient.start('localhost', 1234)
    .then( ()=> console.log("connection successfull"))
    .catch( (e)=> console.error(e));
```

Where `localhost` and `1234` are replaced by the TCP IP adress and port of the running server instance.

It is often more convenient to make this initial connection through the async/await style the following way.

```javascript
import jmClient from 'ms-jobmanager'

(async() => {

    try {
        await = jmClient.start('localhost', 1234)
    } catch(e) {
        logger.error(e);
    }

})();
```



#### Local script file

#### Script configuration and variables

link to jobopt interface

special case for inputs, example needed

#### Submit your script


#### Obtain job results

### Server-side

* Latest Stable Release
* msjob-manager as promise is required for simple end-user
* no job FS interface
