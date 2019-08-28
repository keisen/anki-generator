const path = require('path');
const fs = require('fs');
const csv = require('csv');
const iconv = require('iconv');
const _ = require('underscore');
const normalize = require("normalize-html-whitespace");
const weblio = require('./lib/scraping.js').weblio;
const getWord = require('./lib/webapi.js').words;
const getExample = require('./lib/webapi.js').twinword;

const src = process.argv[2];
const dst = process.argv[3];
console.info(`src: ${src}, dest: ${dst}, workdir: ${process.cwd()}`);

const templateDir = path.join(__dirname, 'templates');
const cardTemplate = _.template(fs.readFileSync(path.join(templateDir, 'card.html'), 'utf8'));
const definitionTemplate = _.template(fs.readFileSync(path.join(templateDir, 'definition.html'), 'utf8'));
const corpusTemplate = _.template(fs.readFileSync(path.join(templateDir, 'corpus.html'), 'utf8'));

const loadCsvFile = () => {
  return new Promise((resolve) => {
    fs.createReadStream(path.join(process.cwd(), src))
      .pipe(csv.parse({delimiter: '\t', relax_column_count: true},
                      (err, records) => resolve(records)));
  });
};

const lookUp = async (record) => {
  let [ word, translated, phrases, translatedPhrases,
        syllables, pronunciation, details, extraExamples ]
    = new Array(8).fill('').map((val, i) => !!record[i] ? record[i] : val)
                           .map((val) => val.trim());
  if (!!word && word.length > 0) {
    // to lowercase
    word = word.toLowerCase();
    // translation by weblio
    if (translated.length == 0 || (phrases.length == 0 && translatedPhrases.length == 0)) {
      let res = await weblio(word);
      if (translated.length == 0) {
        translated = res.translation;
      }
      if (phrases.length == 0 && translatedPhrases.length == 0) {
        let examples = res.examples
                          .map(({en, ja}) => { return { en: en.trim(), ja: ja.trim() }; })
        phrases = examples.map(({en, ja}) => en)
                          .map((en) => `<li>${en}</li>`)
                          .join('');
        translatedPhrases = examples.map(({en, ja}) => `<li>${en}<ul><li>${ja}</li></ul></li>`)
                                    .join('');
      }
    }
    // by words
    if (syllables.length == 0 && pronunciation.length == 0 && details.length == 0) {
      let res = await getWord(word);
      if (res.status == 200 && !!res.body) {
        res = res.body;
        if (!!res.syllables && !!res.syllables.list) {
          syllables = res.syllables.list.join('-');
        }
        if (!!res.pronunciation && !!res.pronunciation.all) {
          pronunciation = res.pronunciation.all;
        }
        if (!!res.results) {
          let definitions = _.groupBy(res.results, (definition) => definition.partOfSpeech);
          Object.keys(definitions).forEach((partOfSpeech) => {
            definitions[partOfSpeech] = definitions[partOfSpeech].map((definition) => {
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
      }
    }
    // by twgd
    if (extraExamples.length == 0) {
      let res = await getExample(word);
      if (res.status == 200 && !!res.body && !!res.body.example) {
        extraExamples = normalize(corpusTemplate({examples: res.body.example}));
      }
    }
  }
  return [ word, translated, phrases, translatedPhrases,
           syllables, pronunciation, details, extraExamples
         ].map((val) => val.replace(/\t?\r?\n/g, '').trim());
};

const writeCsvFile = (records) => {
  csv.stringify(records, {delimiter: '\t'}, (error, record) => {
    fs.writeFileSync(path.join(process.cwd(), dst), record);
  });
};

(async () => {
  try {
    let records = await loadCsvFile();
    records = records.map(async (record) => await lookUp(record));
    writeCsvFile(await Promise.all(records));
  } catch(err) {
    console.error(err);
  }
})();

