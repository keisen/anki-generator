const path = require('path');
const fs = require('fs');
const shell = require('shelljs');
const unirest = require('unirest');

const API_KEY = process.env.RAPID_API_KEY;
const wordsCacheDir = path.join(__dirname, '..', 'cache', 'words');
const twinwordCacheDir = path.join(__dirname, '..', 'cache', 'twinword');
if (!fs.existsSync(wordsCacheDir)) {
  shell.mkdir('-p', wordsCacheDir);
  console.log(`Cache directory was created! Path: "${wordsCacheDir}"`);
}
if (!fs.existsSync(twinwordCacheDir)) {
  shell.mkdir('-p', twinwordCacheDir);
  console.log(`Cache directory was created! Path: "${twinwordCacheDir}"`);
}

let apiCallCount = 0;

const wait = () => {
  return new Promise((resolve) => {
    setTimeout(resolve, apiCallCount++ * 1000);
  });
};

const words = async (word)=> {
  let res = await rapidapi(word,
                           `https://wordsapiv1.p.rapidapi.com/words/${word}`,
                           "wordsapiv1.p.rapidapi.com",
                           wordsCacheDir);
  let remaining = res.remaining;
  let limit = res.limit;
  if (res.status == 200 && !!res.body) {
    console.log(
      `Getting data from wordsapi was successed!` +
      ` Word: "${word}"` +
      (res.src == 'cache' ? '' : `, Limit: ${remaining}/${limit}`));
  } else {
    console.warn(
      `Getting data from wordsapi was failed!` +
      ` Word: "${word}"` +
      `, Limit: ${remaining}/${limit}` +
      `, MSG: "${res.body.result_msg}"`);
  }
  return res;
};

const twinword = async (word)=> {
  let res = await rapidapi(word,
                           `https://twinword-word-graph-dictionary.p.rapidapi.com/example/?entry=${word}`,
                           "twinword-word-graph-dictionary.p.rapidapi.com",
                           twinwordCacheDir);
  let remaining = res.remaining;
  let limit = res.limit;
  if (res.status == 200 && !!res.body) {
    console.log(
      `Getting data from twinword was successed!` +
      ` Word: "${word}"` +
      (res.src == 'cache' ? '' : `, Limit: ${remaining}/${limit}`));
  } else {
    console.warn(
      `Getting data from twinword was failed!` +
      ` Word: "${word}"` +
      `, Limit: ${remaining}/${limit}` +
      `, MSG: "${res.body.message}"`);
  }
  return res;
}

const rapidapi = (word, url, host, cacheDir) => {
  let jsonPath = path.join(cacheDir, `${word}.json`);
  if (!!fs.existsSync(jsonPath)) {
    return (async () => {
      let cache = JSON.parse(fs.readFileSync(jsonPath, 'utf8'));
      return { status: 200, body: cache, src: 'cache' };
    })();
  } else {
    return wait().then(() => {
      return new Promise((resolve) => {
        unirest("GET", url)
        .header("x-rapidapi-host", host)
        .header("x-rapidapi-key", API_KEY)
        .end((result) => {
          result.src = 'web';
          result.remaining = result.headers['x-ratelimit-requests-remaining'];
          result.limit = result.headers['x-ratelimit-requests-limit'];
          if (result.status == 200 && !!result.body) {
            fs.writeFileSync(jsonPath, JSON.stringify(result.body));
          }
          resolve(result);
        });
      });
    });
  }
};

module.exports = {
  words: words,
  twinword: twinword
}
