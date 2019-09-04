#!/usr/bin/env node

const program = require('commander');
const path = require('path');
const fs = require('fs-extra');
const chalk = require('chalk');
const { getVideoDurationInSeconds } = require('get-video-duration');

/**
* Returns the duration in a hh:mm:ss format.
* @param duration The duration in seconds.
*/
function prettifyDuration(duration) {

  let min = Math.floor(duration / 60);
  let sec = duration % 60;
  let hr = Math.floor(min / 60);
  min = Math.floor(min % 60);

  sec = (sec < 10 ? '0' : '') + sec;
  min = (min < 10 ? '0' : '') + min;
  hr = (hr < 10 ? '0' : '') + hr;

  return `${hr}:${min}:${sec}`;

}

/**
* Scans a directory for video files and returns an array of video file paths (absolute).
* @param dirname The absolute path to the directory (must be valid).
*/
async function scanDir(dirname) {

  const children = await fs.readdir(dirname);
  let videos = [];

  for ( const child of children ) {

    if ( (await fs.stat(path.resolve(dirname, child))).isDirectory() )
      videos = videos.concat(await scanDir(path.resolve(dirname, child)));
    else if ( ['.avi', '.mkv', '.mp4', '.m4v', '.mpeg', '.vob', '.wmv'].includes(path.extname(child)) )
      videos.push(path.resolve(dirname, child));

  }

  return videos;

}

/**
* Returns the sum of all the video file durations in a given directory.
* @param dirname A path to a directory to scan.
*/
async function getLengthSum(dirname) {

  const stats = await fs.stat(dirname);

  if ( ! stats.isDirectory() ) throw new Error('Target must be a directory!');

  console.log('Scanning directory:', chalk.yellowBright.bold(dirname));

  const files = await scanDir(dirname);

  console.log(`Found ${chalk.bold.yellowBright(files.length)} files...`);

  let sum = 0;
  let errors = 0;
  let counter = 0;

  for ( const file of files ) {

    console.log(`Reading file ${chalk.bold.yellowBright(++counter)}/${files.length}`);

    try {

      sum += await getVideoDurationInSeconds(file);

    }
    catch (error) {

      errors++;
      console.log(chalk.redBright.bold(error.message));

    }

  }

  return {
    seconds: sum,
    time: prettifyDuration(sum),
    skippedFiles: errors,
    totalFiles: files.length
  };

}

let dirname = '.';

program
.version(require(path.resolve(__dirname, 'package.json')).version)
.option('-a, --absolute', 'indicates if dirname is an absolute path')
.arguments('<dirname>')
.action(arg => {

  if ( arg ) dirname = arg;

})
.parse(process.argv);

getLengthSum(program.absolute ? dirname : path.resolve(process.cwd(), dirname))
.then(console.log)
.catch(error => console.log(chalk.redBright.bold(error.message)));
