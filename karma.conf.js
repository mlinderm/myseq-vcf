/* eslint-disable */
module.exports = function(config) {
  config.set({
    frameworks: ['mocha', 'chai'],
    files: [
      'dist/myseq-vcf.js',
      'test/**/*.test.js',
      { pattern: 'test-data/*', watched: false, included: false, served: true, nocache: false }
    ],
    reporters: ['mocha'],
    port: 9876,  // karma web server port
    colors: true,
    logLevel: config.LOG_INFO,
    browsers: ['ChromeHeadless'],
    autoWatch: false, // Will automatically watch test files
    singleRun: true, // Karma captures browsers, runs the tests and exits
    concurrency: Infinity,
    customLaunchers: {
      ChromeHeadlessNoSandbox: {
        base: 'ChromeHeadless',
        flags: ['--no-sandbox']
      }
    }
  })
}
