const path = require('path');
const fs = require('fs');
const csv = require('csv');
const unirest = require('unirest');
const iconv = require('iconv');
const _ = require('underscore');
const normalize = require("normalize-html-whitespace");

const API_KEY = process.env.RAPID_API_KEY;

const src = process.argv[2];
const dst = process.argv[3];
const cacheDir = path.join(process.cwd(), 'cache');

console.info(`src: ${src}, dest: ${dst}, cacheDir: ${cacheDir}, workdir: ${process.cwd()}`);
if (!fs.existsSync(cacheDir)) {
  fs.mkdirSync(cacheDir);
  console.log(`Cache directory was created! Path: \"${cacheDir}\"`);
}

const template = _.template(fs.readFileSync('./templates/template.html', 'utf8'));
const definitionTemplate = _.template(fs.readFileSync('./templates/definition.html', 'utf8'));
const examplesTemplate = _.template(fs.readFileSync('./templates/examples.html', 'utf8'));

let apiCallCount = 0;

const getWord = function(word, callback, ...args) {
  setTimeout(function(word, callback, ...args) {
    unirest("GET", "https://wordsapiv1.p.rapidapi.com/words/" + word)
    .header("x-rapidapi-host", "wordsapiv1.p.rapidapi.com")
    .header("x-rapidapi-key", API_KEY)
    .end(function(result) {
      callback(result, ...args);
    });
  }, apiCallCount++ * 1000, word, callback, ...args);
};

const getExample = function(word, callback, ...args) {
  setTimeout(function(word, callback, ...args) {
    unirest("GET", "https://twinword-word-graph-dictionary.p.rapidapi.com/example/?entry=" + word)
    .header("x-rapidapi-host", "twinword-word-graph-dictionary.p.rapidapi.com")
    .header("x-rapidapi-key", API_KEY)
    .end(function(result) {
      callback(result, ...args);
    });
  }, apiCallCount++ * 1000, word, callback, ...args);
};

const lookUp = function(word, callback) {
  word = word.toLowerCase();
  let jsonPath = path.join(cacheDir, `${word}.json`);
  if (!!fs.existsSync(jsonPath)) {
    console.log(`Cache data was found. Word: \"${word}\"`);
    callback(JSON.parse(fs.readFileSync(jsonPath, 'utf8')));
  } else {
    getWord(word, function(result) {
      let remaining = result.headers['x-ratelimit-requests-remaining'];
      let limit = result.headers['x-ratelimit-requests-limit'];
      let wordData = {};
      if (result.status == 200) {
        console.log(`Getting data was successed! Word: \"${word}\", Limit: ${remaining}/${limit}`);
        wordData = result.body;
      } else {
        console.warn(`Getting data was failed! Word: \"${word}\", Limit: ${remaining}/${limit}, MSG: \"${result.body.result_msg}'\"`);
        if (result.status != 404) {
          console.error(result);
          throw result;
        }
      }
      getExample(word, function(result) {
        let remaining = result.headers['x-ratelimit-requests-remaining'];
        let limit = result.headers['x-ratelimit-requests-limit'];
        let extraExamples = [];
        if (result.status == 200 && !!result.body && !!result.body.example && result.body.example.length > 0) {
          console.log(`Getting examples was successed! Word: \"${word}\", Limit: ${remaining}/${limit}`);
          extraExamples = result.body.example;
        } else {
          console.warn(`Getting examples was failed! Word: \"${word}\", Limit: ${remaining}/${limit}, MSG: \"${result.body.message}'\"`);
        }
        wordData.extraExamples = extraExamples;
        fs.writeFileSync(jsonPath, JSON.stringify(wordData));
        callback(wordData);
      });
    });
  }
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
    let word = value[0].trim();
    let translated = value.length > 1 ? value[1].trim() : '';
    let syllables = '';
    let pronunciation = '';
    let details = '';
    let extraExamples = '';
    if (!!word && word.length > 0) {
      lookUp(word, function(res) {
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
          details = normalize(template({definitions: definitions}));
        }
        if (!!res.extraExamples.length > 0) {
          extraExamples = normalize(examplesTemplate({examples: res.extraExamples}));
        }
        outputs.push([ word, translated, syllables, pronunciation, details, extraExamples ]);
			});
    } else {
      console.log(`No: ${index}, Word: \"${word}\", was skipped.`);
      outputs.push([ word, translated, syllables, pronunciation, details, extraExamples ]);
    }
  });
  const finalize = function(data, outputs, dst) {
    setTimeout(function(data, outputs, dst) {
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
        finalize(data, outputs, dst);
      }
    }, 1000, data, outputs, dst);
  };
  finalize(data, outputs, dst);
}));

