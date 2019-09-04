#!/usr/bin/env node

const program = require('commander');
const path = require('path');
const fs = require('fs-extra');
const ffprobe = require('ffprobe');
const static = require('ffprobe-static');

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
* Parses a duration string.
* @param duration The duration string.
* @param ext The file extension given by path.extname().
*/
function parseDuration(duration, ext) {

  if ( ext !== '.mkv' ) return +duration;

  const segments = duration.split(':');

  return (+segments[0] * 3600) + (+segments[1] * 60) + +segments[2];

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

  const files = await scanDir(dirname);
  let sum = 0;
  let skipped = 0;

  for ( const file of files ) {

    const info = await ffprobe(file, { path: static.path });

    if ( ! info.streams || ! info.streams.length || (! info.streams[0].duration && ! info.streams[0].tags && ! info.streams[0].tags.DURATION) ) {

      skipped++;
      console.log(`File "${file}" was skipped because its tags could not be read!`);
      continue;

    }

    sum += parseDuration(info.streams[0].duration || info.streams[0].tags.DURATION, path.extname(file));

  }

  return {
    seconds: sum,
    time: prettifyDuration(sum),
    skippedFiles: skipped,
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
.catch(console.log);
