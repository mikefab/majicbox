var _ = require('lodash');

var Mobility = require('./app/models/mobility');
var Region = require('./app/models/region');

// TODO(jetpack): Should these functions throw errors when there's no data?

/** Return all regions for the country.
 * @param{string} country_code - Country.
 * @return{Promise} Array of Region objects with properties `region_code`,
 *   `name`, `geo_area_sqkm`, and `geo_feature`.
*/
function get_regions(country_code) {
  return Region.find({country_code: country_code})
    .select('region_code name geo_area_sqkm geo_feature')
    .then(function(regions) {
      return regions.map(function(region) {
        return _.pick(
          region, ['region_code', 'name', 'geo_area_sqkm', 'geo_feature']);
      });
    });
}

// TODO(jetpack): Change the date range params. Figure out how to do unions
// (null, 1 date, and pair of dates).

/** Returns relative population estimates for the country.
 * @param{string} country_code - Country.
 * @param{string} start_time - Date. See comment for end_time.
 * @param{string} end_time - Date. If neither start_time nor end_time are given,
 *   returns the most recent data available. If only start_time given, returns
 *   data for that time. If both given, returns all data between the 2 times
 *   (inclusive). It's invalid for only end_time to be specified.
 * @return{Promise} Nested mapping from date to region code to population value.
 *   Dates are represented in ISO string format.
 */
function get_region_populations(country_code, start_time, end_time) {
  return Region.find({country_code: country_code})
    .select('region_code')
    .then(function(regions) {
      // For each region, find the self-migration Mobility data and add it to
      // `result`. When all `region_promises` are fulfilled, we're done.
      var result = {};
      var region_promises = regions.map(function(region) {
        return new Promise(function(resolve, reject) {
          var conditions = {country_code: country_code,
                            origin_region_code: region.region_code,
                            destination_region_code: region.region_code};
          var query;
          if (start_time && end_time) {
            conditions.date = {$gte: start_time, $lte: end_time};
            query = Mobility.find(conditions);
          } else if (start_time) {
            conditions.date = start_time;
            query = Mobility.find(conditions);
          } else {
            // else, get the latest mobility data due to sorting.
            query = Mobility.find(conditions).limit(1);
          }
          query.exec(function(err, mobilities) {
            if (err) { return reject(err); }
            mobilities.forEach(function(mobility) {
              _.set(result, [mobility.date.toISOString(), region.region_code],
                    mobility.count);
            });
            resolve();
          });
        });
      });
      return Promise.all(region_promises).then(function() { return result; });
    });
}

/** Simple timing tool. `stopwatch.reset` resets the timer. Subsequent calls to
 * `stopwatch.click` will output a console message with the time since the last
 * `click` or `reset`.
 */
// TODO(jetpack): change to take key, so can have multiple, overlapping
// stopwatches running. or, return stopwatch objects.
var stopwatch = (function() {
  var global_stopwatch_last_time = 0;
  /** Reset stopwatch to time new sequence.
   * @param{object} msg - Gets logged.
   */
  function reset(msg) {
    global_stopwatch_last_time = Date.now();
    if (msg) { console.log('\n' + msg, global_stopwatch_last_time); }
  }
  // TODO(jetpack): change to log `arguments`, like console.log.
  /** Log time since last click (or reset).
   * @param{object} msg - Gets logged along with the time.
   */
  function click(msg) {
    var now = Date.now();
    console.log(msg, now - global_stopwatch_last_time);
    global_stopwatch_last_time = now;
  }
  return {reset: reset, click: click};
})();

module.exports = {
  get_regions: get_regions,
  get_region_populations: get_region_populations,
  stopwatch: stopwatch
};
