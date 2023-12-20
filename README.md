# MOBI JobManager
## June2022 @ZenGarden release

![alt text](./assets/ryoanji.png "Have a seat & relax")

## Push, Have a Tea and Relax

The jobmanager ecosystem allows for the submission of SHELL script or commands from a "client" JavaScript runtime to a remote node "server" program. The server handles the scheduling of jobs by converting them to POSIX threads or by passing them to a SLURM process. The client __ a single npm package __ exposes a simple push API with asynchronous access to the results of the job. Under the hood, client/server communication uses the socket-io stream API.
Additional execution environments of the server instance can be added by implementing engine contract.

A typical "client" runtime can be an express server or a nest application (see:// nest application repo).

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
As a first step, we will just load the library and try to connect to a running server instance.
To handle these initial connection steps, the client API exposes the Promise-resolved `start` function.


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
The client interface exposes a `push` method which supports two types of command submissions.
* **SHELL scripts** are submitted by specifiying their paths.

```javascript
const script = "/path/to/my/script.sh" 
const stdout = await jmClient.push({ script });
```

* **SHELL command lines** are submitted as plain strings.

```javascript
const cmd = "echo hello; echo world"
const stdout = await jmClient.push({ cmd });
```

##### Settings for the job execution

The client `push` method accepts a single object argument. This *job-options* object provides usefull controls over the job execution environment. Its most usefull properties are the following:

* `script`, a valid path to the script to execute
* `cmd`, a valid line of shell commands
* `exportVar`, a litteral of key/value pairs of environment variables to be exported in the execution SHELL of the job, where keys are symbols and values, well, values. For instance, `{"x" : 2}`  would be identical to `export x=2` within the script itself. 

```javascript
const cmd = "echo I am $age years old!"
const exportVar = { age : 10 }
const stdout = await jmClient.push({ cmd, exportVar }); 
console.log(stdout)//I am 10 years old!
```

As you can see, you have a direct access to the job standard output upon its completion.
If you need more access to the final state of your job working folder, you should use the [pushFS](#Accessing_job_results_folder) method.

##### Settting the job inputs

If environnement variables are not enough to feed your jobs, files can be provided through the *job-options* `inputs` field.
It is important to note that **all provided files will be cached under the "input/" folder in the working folder of your job**.

Files can be passed directly as a list, in which case their basename will be preserved (note the mention of the mandatory "input/" folder in the job command).

```javascript
const cmd = "cat input/nice_file.txt"
const inputs = ['/path/to/my/file/nice_file.txt']
const stdout = await jmClient.push({ cmd, inputs }); 
console.log(stdout)// the content of 'nice_file.txt'
```

If input files need to be renamed, they can be passed as key/value pairs, in which case values are valid source paths and keys the name under which files should be copied into the job work folder.

```javascript
const cmd = "cat input/alt_name.txt"
const inputs = { 'alt_name.txt' : '/path/to/my/file/nice_file.txt'}
const stdout = await jmClient.push({ cmd, inputs }); 
console.log(stdout)// the content of the original 'nice_file.txt'
```

Inputs can also be provided as stream instead of file path.  

```javascript
const cmd = "cat input/alt_name.txt"

const my_stream:Readable = new Readable(); //Create a Stream
my_stream.push('random string'); //Fill with your string
my_stream.push(null); //Close it 

const inputs = { 'alt_name.txt' : my_stream}
const stdout = await jmClient.push({ cmd, inputs }); 
console.log(stdout)// the 'random string' string
```

###### Obfuscating the job inputs !!

Ultimately, one can provide any array mixing the previous types (see [this example](./src/examples/mixing_inputs.ts)).
Hence the following inputs array and submission,
```javascript
import { ClientInputAPI }   from 'ms-jobmanager';
import { createReadStream } from 'fs';

const cmd = "cat input/*";

const inputs = [ 
    "/some/path/data/hello.sh",
    { 
    "a.txt" : "/the/same/path/hello.sh",
    "b.txt" :  createReadStream("/another/path/hello.sh")
    },
    "/some/other/path/file.txt",
    { 
    "c.txt" : "/here/data/file2.txt",
    "d.txt" :  createReadStream("/there/data/hello_many.sh")
    }
] as ClientInputAPI;

const stdout = await jmClient.push({ cmd, inputs });
```

will cat to stdout the content of 6 created files  named `input/hello.sh, input/a.txt, input/b.txt, input/file.txt, input/c.txt, input/d.txt` (located in the job working directory).

<span style="font-weight:bold">Be aware that identical destination filenames are forbidden and will trigger job rejection at submission.</span>



#### Accessing_job_results_folder

The client `pushFS` method allows for the inspection of a job work folder, to list its content or read its files.
It will return an object which can be destructured to get in addition to the standard output of the job, a *JobFileSystem* object with the following methods:

* `list(path?:string)`, which takes an optional relative path rooted to the job execution folder and returns its content as a list of strings;
* `readToStream(filepath:string)`, which returns a readable stream from the desired file
* `readToString(filepath:string)`, which returns a string of the content of the desired file
* `copy(sourceFileName:string, targetFileName:Path)`, which copies a file from the job working folder to a target location

```javascript
const cmd = 'echo "ready to" > beam_up.txt; echo "hello";'
const { stdout, jobFS } = await jmClient.pushFS({ cmd }); 
console.log(stdout)// "hello"
const fileContent = await jobFS.readToString('beam_up.txt');
console.log(fileContent)// "ready to"
```
* `zap()`, which returns a readable stream of the entier job work folder a zip archive.
```javascript
const zipArchiveStream = await jobFS.zap();
const output   = createWriteStream('./data_out.zip');
zipArchiveStream.pipe(output);
// data_out.zip bundles the entiere work folder content
```

#### Creating pipeline of jobs
Batches of jobs can be combined to implement pipelines.
Array of jobs can be joined using the *pushMany* method.
The resulting array of results is an iterator over the stdout of each job. The order of submission is maintained.

```javascript
const results = await jmClient.pushMany([
            {cmd : 'sleep 1 ; echo "Job 1 output"'},
            {cmd : 'sleep 10; echo "Job 2 output"'}
]);
// ~ 10 sc later
results.forEach((stdout, i)=> {
    console.log(`${i} ==> ${stdout}`) // Job 1 output
});                                   // Job 2 output
```

Because the execution of the local function awaits for all jobs completion, jobs can be easily chained. We illustrate this by using the *pushManyFS* method.
This functions also awaits for the completion of submitted jobs and then iterates over each job stdout and jobFS object.

```javascript
const resultsFS = await jmClient.pushManyFS([
    {cmd : 'sleep 1 ; echo "Job 1 output" > job1.out'},
    {cmd : 'sleep 10; echo "Job 2 output" > job2.out'}
]);
//~ 10sc later
const stream1 = resultsFS[0].jobFS.readToStream("job1.out");
const stream2 = resultsFS[1].jobFS.readToStream("job2.out");
const stdout = await jmClient.push({
    cmd: "paste input/job1.in input/job2.in",
    inputs : {  "job1.in" : stream1,
                "job2.in" : stream2,
    }
});
console.log(stdout); // "Job 1 output Job 2 output""
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
Running a POSIX thread instance of the job-manager server with the **emulate** engine flag, here we specify a maximum number of 2 submitted jobs.
```sh
npm run server -- -c /[PATH TO FOLDER CACHE] -e emulate -n 2
```

#### Configuration file


#### Adding job profile


#### Adding engine



## Additional examples can be found under the [example folder]('https://github.com/MMSB-MOBI/ms-jobmanager/tree/master/src/examples)
![alt text](./assets/takenoko.jpeg "Have a seat & relax")
