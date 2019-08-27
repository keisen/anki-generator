const path = require('path');
const fs = require('fs');
const reqp = require('request-promise');
const cheerio = require('cheerio');

const cacheDir = path.join(__dirname, '..', 'cache', 'weblio');

if (!fs.existsSync(cacheDir)) {
  fs.mkdirSync(cacheDir);
  console.log(`Cache directory was created! Path: \"${cacheDir}\"`);
}

let callCount = 0;

const scrape = ($, err, callback, ...args) => {
  let response = {
    translation: '',
    examples: []
  };
  if (!err) {
    response.translation = $('td.content-explanation.ej').text(),
    $('.hideDictPrs .qotC').each((i, qotC) => {
      let example = '';
      $(qotC).find('.qotCE').contents().each((j, word) => {
        let element = $(word);
        if (!element.hasClass('squareCircle') && !element.hasClass('addToSlBtnCntner')) {
          example += element.text();
        }
      });
      let translated_example = '';
      $(qotC).find('.qotCJ').contents().each((j, word) => {
        let element = $(word);
        if (!element.get(0).tagName) {
          translated_example += element.text();
        }
      });
      response.examples.push({
        en: example,
        ja: translated_example
      });
    });
  }
  callback(response, err, ...args);
};

const weblio = (word, callback, ...args) => {
  let cachePath = path.join(cacheDir, `${word}.html`);
  if (!!fs.existsSync(cachePath)) {
    console.log(`Cache weblio-data was found. Word: \"${word}\"`);
    let $ = cheerio.load(fs.readFileSync(cachePath, 'utf8'));
    scrape($, null, callback, ...args);
  } else {
    setTimeout((word, callback, ...args) => {
      (async () => {
        try {
          let res =  await reqp.get('https://ejje.weblio.jp/content/' + word);
          fs.writeFileSync(cachePath, res);
          let $ = cheerio.load(res);
          scrape($, null, callback, ...args);
        } catch(error) {
          console.error(error);
          scrape(null, error, callback, ...args);
        }
      })();
    }, callCount++ * 3000, word, callback, ...args);
  }
};

module.exports = {
  weblio: weblio
}
