const path = require('path');
const fs = require('fs');
const csv = require('csv');
const iconv = require('iconv');
const _ = require('underscore');
const normalize = require("normalize-html-whitespace");
const weblio = require('./lib/scraping.js').weblio;
const getWord = require('./lib/webapi.js').word;
const getExample = require('./lib/webapi.js').examples;

const src = process.argv[2];
const dst = process.argv[3];
const cacheDir = path.join(__dirname, 'cache');
console.info(`src: ${src}, dest: ${dst}, cacheDir: ${cacheDir}, workdir: ${process.cwd()}`);

const templateDir = path.join(__dirname, 'templates');
const cardTemplate = _.template(fs.readFileSync(path.join(templateDir, 'card.html'), 'utf8'));
const definitionTemplate = _.template(fs.readFileSync(path.join(templateDir, 'definition.html'), 'utf8'));
const corpusTemplate = _.template(fs.readFileSync(path.join(templateDir, 'corpus.html'), 'utf8'));

const lookUp = (word, callback)=> {
  word = word.toLowerCase();
  getWord(word, (result)=> {
    let wordData = {};
    if (result.status == 200 && !!result.body) {
      wordData = result.body;
    } else if (result.status != 404) {
      console.error(result);
      throw result;
    }
    getExample(word, function(result) {
      let extraExamples = [];
      if (result.status == 200 && !!result.body && !!result.body.example && result.body.example.length > 0) {
        extraExamples = result.body.example;
      }
      wordData.extraExamples = extraExamples;
      callback(wordData);
    });
  });
};

const finalize = function(data, outputs) {
  setTimeout(function(data, outputs) {
    if (data.length === outputs.length) {
      outputs = outputs.map(function(output) {
        return output.map(function(val) {
          return val.replace(/\t?\r?\n/g, '').trim();
        });
      });
      csv.stringify(outputs, {delimiter: '\t'}, function(error,output) {
        fs.writeFileSync(path.join(process.cwd(), dst), output);
      });
    } else {
      finalize(data, outputs);
    }
  }, 1000, data, outputs);
};

fs.createReadStream(path.join(process.cwd(), src)).pipe(
  csv.parse({delimiter: '\t', relax_column_count: true}, function(err, data) {
  if (!!err) {
    console.error(err);
    return;
  }
  console.log(`Starting: Number of data is ${data.length}.`, );
  const outputs = [];
  data.forEach(function(value, index, ary) {
    if (!value || value.length == 0) {
      console.error(`Error: Loaded invalid record. index: ${index}`);
    }
    let [
          word,
          translated, phrases, translatedPhrases,
          syllables, pronunciation, details, extraExamples
         ] = new Array(8).fill('').map((val, i) => !!value[i] ? value[i] : val)
                                  .map(val => val.trim());
    let serialize = () => {
      outputs.push([ 
        word,
        translated, phrases, translatedPhrases,
        syllables, pronunciation, details, extraExamples
      ]);
    };
    let translate = (word) => {
      if (translated.length == 0 || (phrases.length == 0 && translatedPhrases.length == 0)) {
        weblio(word, (res, err) => {
          if (translated.length == 0) {
            translated = res.translation;
          }
          if (phrases.length == 0 && translatedPhrases.length == 0 && res.examples.length > 0) {
            let examples = res.examples
                              .map(({en, ja}) => { return { en: en.trim(), ja: ja.trim() }; })
            phrases = examples.map(({en, ja}) => { return en; })
                              .map((en) => { return `<li>${en}</li>`; })
                              .join('');
            translatedPhrases = examples.map(({en, ja}) => {
              return `<li>${en}<ul><li>${ja}</li></ul></li>`; }).join('');
          }
          if (!err && res.translation.length > 0) {
            console.log(`Getting translated was successed! Word: \"${word}\"`);
          } else {
            console.warn(`Getting translated was failed! Word: \"${word}\"`);
          }
          serialize();
        });
      } else {
        serialize();
      }
    };
    if (!!word && word.length > 0) {
      if (syllables.length == 0 && pronunciation.length == 0 &&
          details.length == 0 && extraExamples.length == 0) {
        lookUp(word, (res) => {
          if (!!res.syllables && !!res.syllables.list) {
            syllables = res.syllables.list.join('-');
          }
          if (!!res.pronunciation && !!res.pronunciation.all) {
            pronunciation = res.pronunciation.all;
          }
          if (!!res.results) {
            let definitions = _.groupBy(res.results, function(definition) {
              return definition.partOfSpeech;
            });
            Object.keys(definitions).forEach(function(partOfSpeech) {
              definitions[partOfSpeech] = definitions[partOfSpeech].map(function(definition) {
                return definitionTemplate({
                  definition: definition.definition,
                  synonyms: definition.synonyms,
                  antonyms: definition.antonyms,
                  examples: definition.examples,
                });
              }).join('');
            });
            details = normalize(cardTemplate({definitions: definitions}));
          }
          if (!!res.extraExamples.length > 0) {
            extraExamples = normalize(corpusTemplate({examples: res.extraExamples}));
          }
          translate(word);
        });
      } else {
        translate(word);
      }
    } else {
      console.log(`No: ${index}, Word: \"${word}\", was skipped.`);
      outputs.push([ word, translated, phrases, translatedPhrases, syllables, pronunciation, details, extraExamples ]);
    }
  });
  finalize(data, outputs);
}));

