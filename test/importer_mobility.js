var assert = require('chai').assert;
var csv = require('fast-csv');
var mongoose = require('mongoose');

var Mobility = require('../app/models/mobility');
var importer = require('../lib/import/mobility');
var testutil = require('./testutil');

var test_migrations_dir = './test/data/mobility/br/';
var test_migrations_csv_filename = 'admin_mobility_matrix_20150201.csv';

var country_code = 'br';

describe('Import mobility', function() {
  before(function initializeDatabase() {
    return testutil.connect_and_clear_test_db()
      .then(function() {
        return importer.import_mobility(test_migrations_dir, country_code);
      });
  });

  after(function(done) {
    mongoose.disconnect(done);
  });

  describe('Mobility data stored', function() {
    it(
      'should store date, country code, origin, destination, and count',
      function(done) {
        var all_done = [];
        var count = 0;
        csv.fromPath(test_migrations_dir + '/' + test_migrations_csv_filename)
        .on('data', function(data) {
          var origin_region_code = data[1];
          var promise = new Promise(function(resolve) {
            if (count === 1) {
              Mobility.find({
                origin_region_code: origin_region_code
              }, function(err, records) {
                assert.ifError(err, 'error finding record');
                assert.strictEqual(
                  origin_region_code,
                  records[0].origin_region_code
                );
                resolve();
              });
            }
            count += 1;
          });
          if (count === 2) {
            all_done.push(promise);
          }
        })
        .on('end', function() {
          Promise.all(all_done).then(function() {
            done();
          });
        });
      });
  });
});
