# MOBI JobManager
## June2022 @ZenGarden release

![alt text](./assets/ryoanji.png "Have a seat & relax")

## Push, Have a Tea and Relax

Ths jobmanager ecosystem allows for the submission of SHELL script or commands from a client JavaScript runtime to a remote server JavaScript program. The server handles to scheduling of jobs by converting them to POSIX threads or by passing them to a SLURM process. The client exposes a simple push API with asynchronous access to the results of the job. Under the hood, client/server communication uses the stream socket-io API.
Additional execution environments for the server instance can be added by simply implementing engine contract.

A typical client environment can be an express server or a nest application (see:// nest application repo).

## Installation

```sh
npm install ms-jobmanager
```

## Client-side

You just need to import the client library.

```javascript
import jmClient from 'ms-jobmanager'
```

It will provide you with a NodeJS Singleton client object.

#### Connect to a server instance
As a first step, we will just load the library and try to connect with a running server instance.
For initial connection puroposes, the client API exposes the Promise-resolved `start` function.


```javascript
jmClient.start('localhost', 1234)
    .then( ()=> console.log("connection successfull"))
    .catch( (e)=> console.error(e));
```

Where `localhost` and `1234` are replaced by the TCP IP adress and port of the running server instance.

It is often more convenient to make this initial connection through the async/await style the following way.

```javascript
import jmClient from 'ms-jobmanager'

try {
    await jmClient.start('localhost', 1234);
    console.log("connection successfull")
} catch(e) {
    console.error(e);
}
```

#### Submitting commands to the job manager

##### Basic submissions
The client interface supports two kinds of command submissions: SHELL script or command line.
Both submission make use of the `push` client method.
SHELL script are submitted by specifiying their paths.

```javascript
const script = "/path/to/my/script.sh" 
const stdout = await jmClient.push({ script });
```

SHELL command lines are submitted as plain strings.

```javascript
const cmd = "hello world"
const stdout = await jmClient.push({ cmd });
```

##### Setting the job execution

The client `push` method accepts a single object arguments. This *job-options* object provides usefull controls over the job execution environment. Its most usefull properties are the following:

* `script`, a valid path to the script to execute
* `cmd`, a valid shell set of commands [eg : "echo hello; echo world"]
* `exportVar`, a litteral of key/value pairs of environment variables to be exported in the execution SHELL of the job, where keys are symbols and values, well, values. For instance, `{"x" : 2}`  would be identical to `export x=2` within the script itself.* 

```javascript
const cmd = "echo I am $age years old!"
const exportVar = { age : 10 }
const stdout = await jmClient.push({ cmd, exportVar }); 
console.log(stdout)//I am 10 years old!
```

As you can see, you have a direct access to the job standard output upon its completion.
If you need more access to the final state of your job working folder, you should use the [pushFS](#Accessing_job_results_folder) method.

##### Settting the job inputs

If environnement variables are not enough to feed your jobs, files can be provided to through the *job-options* `inputs` field.
It is important to note that **all provided files will be cached under the input folder in the working folder of your job**.

Files can be passed directly as a list, in which case their basename will be preserved.

```javascript
const cmd = "cat input/nice_file.txt"
const inputs = ['/path/to/my/file/nice_file.txt']
const stdout = await jmClient.push({ cmd, inputs }); 
console.log(stdout)// the content of 'nice_file.txt'
```

Or key/value pairs, in which case values are valid paths and keys the name under which files should be copied into the job work folder.

```javascript
const cmd = "cat input/alt_name.txt"
const inputs = { alt_name.txt : '/path/to/my/file/nice_file.txt'}
const stdout = await jmClient.push({ cmd, inputs }); 
console.log(stdout)// the content of the original 'nice_file.txt'
```

#### Accessing_job_results_folder

The client `pushFS` method allows to inspect a job work folder to list its content or read its files.
It will return an object which can be destructured to get in addition to the standard output of the job, a *JobFileSystem* object with the following methods:

* `list(path?:string)`, which takes an optional relative path and returns a the content of the job folder as a list of strings;
* `readToStream(filepath:string)`, which returns a readable stream from the desired file
* `readToString(filepath:string)`, which returns a string of the content of the desired file

```javascript
const cmd = 'echo "ready to" > beam_up.txt; echo "hello";'
const { stdout, jobFS } = await jmClient.pushFS({ cmd }); 
console.log(stdout)// "hello"
const fileContent = await jobFS.readToString('beam_up.txt');
console.log(fileContent)// "ready to"
```

#### Job error managment

Any content over the standard error stream of a job will set this job on error state and throw an exception.

```javascript
const cmd = 'it_is_not a valid command';
try {
    const stdout = await jmClient.push({ cmd }); 
} catch (e) {
    console.error(e);//it_is_not: command not found
}
```

You must therefore make sure that **no sub-program writes to the standard error** or else redirect it.

## Server-side

#### Starting server

#### Configuration file


#### Adding job profile


#### Adding engine



## Additional exemples can be found under the [example folder]('https://github.com/MMSB-MOBI/ms-jobmanager/tree/master/src/examples)
![alt text](./assets/takenoko.jpeg "Have a seat & relax")
