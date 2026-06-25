// Local stub for the non-published `react-native-pdf-extract` package.
// PDF text extraction is not wired in this build — calls will reject.
module.exports = {
  extractText() {
    return Promise.reject(new Error('react-native-pdf-extract is not bundled in this build'));
  },
};
