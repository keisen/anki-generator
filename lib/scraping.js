const reqp = require('request-promise');
const cheerio = require('cheerio');

let callCount = 0;

const weblio = function(word, callback, ...args) {
  setTimeout(function(word, callback, ...args) {
    (async () => {
      try {
        let $ = await reqp.get('https://ejje.weblio.jp/content/' + word, { transform: cheerio.load });
        let res = $('td.content-explanation.ej').text();
        callback(res, null, ...args);
      } catch(error) {
        callback('', error, ...args);
      }
    })();
  }, callCount++ * 5000, word, callback, ...args);
};

module.exports = {
  weblio: weblio
}
