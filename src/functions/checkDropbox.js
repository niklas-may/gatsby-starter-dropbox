
require('dotenv').config({ path: '.env' });
var fetch = require('isomorphic-fetch'); // or another library of choice.
const Dropbox = require("dropbox/dist/Dropbox-sdk.min").Dropbox;

// const buildHook = process.env.NODE_ENV == "development" ? process.env.MOCK_BUILD_HOOK : process.env.NETLIFY_BUILD_HOOK
const buildHook = process.env.NETLIFY_BUILD_HOOK

var lastFunctionCall = undefined;
const timeTillNextFunctionCall = 10;


function getSecondsPassed(a, b) {
  return Math.abs(a - b) / 1000
}

async function createLockFolder(dbx, path) {
  const response = await dbx.filesCreateFolderV2({ path })
  return response
}


function canProcessFunctionCall(ttnfc) {
  console.log("lastFunctionCall", lastFunctionCall)
  const thisFunctionCall = Date.now();
  console.log("canProcessFunctionCall -> thisFunctionCall", thisFunctionCall)

  if(lastFunctionCall === undefined) {
    lastFunctionCall = thisFunctionCall
    return true
  } else {

    const timePassed = getSecondsPassed(lastFunctionCall, thisFunctionCall);
    console.log("canProcessFunctionCall -> timePassed", timePassed)

    if(timePassed > ttnfc) {
      lastFunctionCall = thisFunctionCall
      return true
    } else {
      return false
    }
  }
}

async function listFiles(dbx, path) {
  const files = await dbx.filesListFolder({ path })
  return files
}

async function callBuildHook() {
  console.log("callling buildhook")
  try {
    await fetch(`${buildHook}`, {
      method: 'post',
      body:    JSON.stringify({}),
      headers: { 'Content-Type': 'application/json' },
  });
    return {msg: "Build hook called"}
  } catch (error) {
    return {error: "Cant't call Build hook"}
  }
}

function checkCanCallBuildHook(files) {
  const hasFiles = files.entries.length > 0 && true  
  const hasLockFolder = files.entries.find(file => file.name === "_Build_Lock") ? true : false

  return hasFiles && !hasLockFolder
}

async function handleDropboxUpdate(dbx, path) {
  const files = await listFiles(dbx, path)

  const canCallBuildHook = checkCanCallBuildHook(files)
  console.log("CAN BUILD? ", canCallBuildHook)

  if(canCallBuildHook) {
    const hookResponse = await callBuildHook()
    return hookResponse
  }
  return {DropboxStatus: "No files in update folder. No need to trigger buildhook"}
}

export async function handler(event, context, callback) {

  const dbxWebHookChallenge = event.queryStringParameters.challenge
  var dbx = new Dropbox({ accessToken: `${process.env.DROPBOX_TOKEN}`, fetch: fetch });

  const canCall = canProcessFunctionCall(timeTillNextFunctionCall)
  console.log("canCall", canCall)
  if(canCall) {
      await handleDropboxUpdate(dbx, `${process.env.DROPBOX_BUILD_FOLDER}`)
  }

  callback(null, {
    // return null to show no errors
    statusCode: 200, // http status code
    body: JSON.stringify({
      msg: dbxWebHookChallenge
    }),
  })
}


// Dropbox Hook

// handler -> event {
//   path: '/checkDropbox',
//   httpMethod: 'POST',
//   queryStringParameters: [Object: null prototype] {},
//   headers: {
//     host: 'callbuildhook.ngrok.io',
//     'user-agent': 'DropboxWebhooks/1.0',
//     accept: '*/*',
//     'accept-encoding': 'gzip,deflate',
//     'x-dropbox-signature': 'a3a196266519e9924a7577b09344826aff1fdeab7c3303512cdec60128416a3f',
//     'content-type': 'application/json',
//     'content-length': '105',
//     'x-forwarded-proto': 'https',
//     'x-forwarded-for': '162.125.16.235'
//   },
//   body: '{"list_folder": {"accounts": ["dbid:AACjRzKi5cD0wVKK2FBdAohZg2z51kVOrEg"]}, "delta": {"users": [602793]}}',
//   isBase64Encoded: false
// }



