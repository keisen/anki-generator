const unirest = require('unirest');

const API_KEY = process.env.RAPID_API_KEY;

let apiCallCount = 0;

const words = function(word, callback, ...args) {
  setTimeout(function(word, callback, ...args) {
    unirest("GET", "https://wordsapiv1.p.rapidapi.com/words/" + word)
    .header("x-rapidapi-host", "wordsapiv1.p.rapidapi.com")
    .header("x-rapidapi-key", API_KEY)
    .end(function(result) {
      let remaining = result.headers['x-ratelimit-requests-remaining'];
      let limit = result.headers['x-ratelimit-requests-limit'];
      if (result.status == 200) {
        console.log(`Getting word-data was successed! Word: \"${word}\", Limit: ${remaining}/${limit}`);
      } else {
        console.warn(`Getting word-data was failed! Word: \"${word}\", Limit: ${remaining}/${limit}, MSG: \"${result.body.result_msg}'\"`);
      }
      callback(result, ...args);
    });
  }, apiCallCount++ * 1000, word, callback, ...args);
};

const twinwordWordGraphDictionary = function(word, callback, ...args) {
  setTimeout(function(word, callback, ...args) {
    unirest("GET", "https://twinword-word-graph-dictionary.p.rapidapi.com/example/?entry=" + word)
    .header("x-rapidapi-host", "twinword-word-graph-dictionary.p.rapidapi.com")
    .header("x-rapidapi-key", API_KEY)
    .end(function(result) {
      let remaining = result.headers['x-ratelimit-requests-remaining'];
      let limit = result.headers['x-ratelimit-requests-limit'];
      if (result.status == 200 && !!result.body && !!result.body.example && result.body.example.length > 0) {
        console.log(`Getting examples was successed! Word: \"${word}\", Limit: ${remaining}/${limit}`);
      } else {
        console.warn(`Getting examples was failed! Word: \"${word}\", Limit: ${remaining}/${limit}, MSG: \"${result.body.message}'\"`);
      }
      callback(result, ...args);
    });
  }, apiCallCount++ * 1000, word, callback, ...args);
};


module.exports = {
  word: words,
  examples: twinwordWordGraphDictionary
}
