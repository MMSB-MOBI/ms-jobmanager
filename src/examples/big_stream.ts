import jmClient from '../client';
import { createReadStream, createWriteStream } from 'fs';
import { Readable } from 'stream';

const fileStringContent = (path:string):Promise<string> => {
    return new Promise ( (res,rej) => {
      const st = createReadStream(path);
      st.setEncoding('utf8');
      let content = '';
      st.on('data', (c) => content += c);
      st.on('close', ()=> { res(content)} );
    });
  }

  const stringToStreamSync = (str: string) => {
    const rStream =  Readable.from(str);
    return rStream;
  }

  const stringToStreamCached = (str:string):Promise<Readable> => {
    const cache = "/tmp/.st_chache";
    return new Promise( (res, rej) => {
      const st_cach = createWriteStream(cache);
      const st_read = stringToStreamSync(str);
      st_read.pipe(st_cach);
      st_cach.on('close' , () => { 
      //  res(cache)
      res ( createReadStream(cache) );
      });
   })
  }

  /*const stringToStreamASync = (str: string) => {
    return new Promise( (res, rej) => {
      const rStream =  Readable.from(str);
      //rStream.on('data')
  }*/
/*
  const stringToStreamChunky = (str: string) => {
    const ma_stream: Readable = new Readable();
    console.log("==>" + str);
    const _ = chunkSubstr(str, 1000);
    console.log(`chunked in ${_.length} pieces`);
    _.map( (c:string) => ma_stream.push(c) );
    //ma_stream.push(str);
    console.log(`stream is loaded`);
    ma_stream.push(null)
    return ma_stream
  } 

  const  chunkSubstr = (str:string, size:number) => {
    const numChunks = Math.ceil(str.length / size)
    const chunks = new Array(numChunks)
  
    for (let i = 0, o = 0; i < numChunks; ++i, o += size) {
      chunks[i] = str.substring(o, size)
    }
  
    return chunks
  }
*/
const inputFileLarge = `${__dirname}/data/big.txt`;
const inputFileSmall = `${__dirname}/data/file.txt`;
//console.warn("Testing submission of large stream input with file renaming and output file access SRC IS " + inputFile);

const port = 2020;
const TCPip = "127.0.0.1";
(async() => {
    
    // This works with big.txt
    //const oneInputStream = createReadStream(inputFile);
  
  // This works
  //const oneInputFile = await fileStringContent(inputFile);  
  //const oneInputStream = await stringToStreamCached(oneInputFile);

  //This works
  //const oneInputStream = stringToStreamSync("toto le lapin");

  // This works with file.txt
//  const oneInputFile = await fileStringContent(inputFileSmall);    
//  const oneInputStream = stringToStreamSync(oneInputFile);

  // This fails with big.txt
  const oneInputFile = await fileStringContent(inputFileLarge);    
  const oneInputStream = stringToStreamSync(oneInputFile);
  

  
    // This doesnt work
    //const oneInputStream = stringToStream('x'.repeat(10*1024 * 100));

    // This works
    //const oneInputStream = stringToStream('x'.repeat(10*1024 * 1024));

    console.info(`applying a shell cmd to a big file`);
    const inputs = { 'renamed_file.txt' : oneInputStream };
    const cmd = "ls -lrtha input/renamed_file.txt"


    try {
        await jmClient.start(TCPip, port);
        console.log("PING ?"); 
        const { stdout, jobFS }  = await jmClient.pushFS({ cmd, inputs });
        console.log(`Job standard output :: ${stdout}`);
        console.log("Accessing output folder items");
        const items = await jobFS.list();
        console.log( `${items.join('\n\t-')}`);      
     
        /*
        console.log("Trying to jobFs readToString the big file");
        const backStr =  await jobFS.readToString("input/renamed_file.txt");
        console.log("Readed out that : " + backStr);
        
        console.log("Trying to jobFs readToStream the big file and pass it to a new job");
        const backStream =  await jobFS.readToStream("input/renamed_file.txt");
        const res2  = await jmClient.pushFS({ cmd : "ls -lrtha input/renamed_file_back.txt",  inputs : { 'renamed_file_back.txt' : backStream } } );
        console.log(`Job standard output :: ${res2.stdout}`);
        console.log("Accessing SECOND output folder items");
        const items2 = await res2.jobFS.list();
        console.log( `${items2.join('\n\t-')}`);      
        */
    } catch(e) {
        console.error(e);
    }
})().then( ()=> process.exit());