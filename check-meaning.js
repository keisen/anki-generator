const path = require('path');
const fs = require('fs');
const csv = require('csv');
const weblio = require('./lib/scraping.js').weblio;

const src = process.argv[2];
const dst = process.argv[3];

const loadCsvFile = () => {
  return new Promise((resolve) => {
    fs.createReadStream(path.join(process.cwd(), src))
      .pipe(csv.parse({delimiter: '\t', relax_column_count: true},
                      (err, records) => resolve(records)));
  });
};

const lookUp = async (record) => {
  let [ word, translated ] = record;
  if (!!word && word.length > 0) {
    // to lowercase
    word = word.toLowerCase();
    // translation by weblio
    let res = await weblio(word);
    translated = res.translation;
  }
  return [ word, translated ].map((val) => val.replace(/\t?\r?\n/g, '').trim());
};

const writeCsvFile = (records) => {
  csv.stringify(records, {delimiter: '\t'}, (error, output) => {
    fs.writeFileSync(path.join(process.cwd(), dst), output);
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

