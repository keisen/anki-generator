const path = require('path');
const fs = require('fs');
const shell = require('shelljs');
const reqp = require('request-promise');
const cheerio = require('cheerio');

const cacheDir = path.join(__dirname, '..', 'cache', 'weblio');
if (!fs.existsSync(cacheDir)) {
  shell.mkdir('-p', cacheDir);
  console.log(`Cache directory was created! Path: "${cacheDir}"`);
}

let callCount = 0;

const wait = () => {
  return new Promise((resolve) => {
    setTimeout(resolve, callCount++ * 5000);
  });
};

const scrape = ($, err) => {
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
  return response;
};

const weblio = (word) => {
  let cachePath = path.join(cacheDir, `${word}.html`);
  if (!!fs.existsSync(cachePath)) {
    return (async () => {
      console.log(`Cache of weblio-page was found. Word: "${word}"`);
      let $ = cheerio.load(fs.readFileSync(cachePath, 'utf8'));
      return scrape($);
    })();
  } else {
    return wait().then(() => {
      return (async () => {
        try {
          let res =  await reqp.get(`https://ejje.weblio.jp/content/${word}`);
          console.log(`Getting weblio-page was successed! Word: "${word}"`);
          fs.writeFileSync(cachePath, res);
          let $ = cheerio.load(res);
          return scrape($);
        } catch(err) {
          console.warn(`Getting weblio-page was failed! Word: "${word}"`, err);
          return scrape(null, error);
        }
      })();
    });
  }
};

module.exports = {
  weblio: weblio
}
