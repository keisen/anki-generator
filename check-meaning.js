const path = require('path');
const fs = require('fs');
const csv = require('csv');
const getTranslate = require('./lib/scraping.js').weblio;

const src = process.argv[2];
const dst = process.argv[3];

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
      let word = value[0].trim();
      let translated = value.length > 1 ? value[1].trim() : '';
      if (translated.length > 0) {
        outputs.push([ word, translated ]);
      } else {
        getTranslate(word, function(res, err) {
          outputs.push([ word, res ]);
          if (!err && res.length > 0) {
            console.log(`Getting translated was successed! Word: \"${word}\"`);
          } else {
            console.warn(`Getting translated was failed! Word: \"${word}\"`);
          }
        });
      }
    });
    finalize(data, outputs);
  }));
