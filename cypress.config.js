const { defineConfig } = require('cypress');
const windsurfReporter = require('./cypress/plugins/windsurf-reporter');

module.exports = defineConfig({
  e2e: {
    setupNodeEvents(on, config) {
      windsurfReporter(on, config);
      return config;
    },
    reporter: 'cypress-multi-reporters',
    reporterOptions: {
      reporterEnabled: 'mochawesome, mocha-junit-reporter',
      mochawesomeReporterOptions: {
        reportDir: 'cypress/results/mochawesome',
        overwrite: false,
        html: true,
        json: true,
        timestamp: 'mmddyyyy_HHMMss'
      },
      mochaJunitReporterReporterOptions: {
        mochaFile: 'cypress/results/junit/results-[hash].xml'
      }
    },
    env: {
      windsurfLearning: {
        enabled: true,
        captureScreenshots: true,
        captureVideos: true,
        analyzePatterns: true,
        createMemories: true,
        insightsPath: 'cypress/insights'
      }
    }
  }
});
