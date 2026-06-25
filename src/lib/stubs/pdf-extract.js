// Stub for `react-native-pdf-extract` (the package the source code references
// but which was never published on npm). Returns a deterministic placeholder
// document so the rest of the ingest pipeline (chunking → embeddings → chat)
// can be exercised end-to-end in the dev build. Real on-device PDF text
// extraction would require a native module wrapping PDFKit (iOS) / PdfBox
// (Android) — out of scope for this build.
const PLACEHOLDER_PAGES = [
  'Photosynthesis is the process by which green plants and some other organisms use sunlight to synthesize foods with the help of chlorophyll. The light-dependent reactions split water and release oxygen. The Calvin cycle then fixes CO2 into glucose using ATP and NADPH.',
  'Mitochondria are the cellular organelles responsible for ATP production via oxidative phosphorylation. The inner membrane is folded into cristae, increasing surface area for the electron transport chain. Each ATP molecule represents about 30 kJ of usable energy.',
  "DNA replication is semi-conservative: each daughter molecule has one parent strand and one new strand. DNA polymerase III is the main replicating enzyme in prokaryotes; it can only add nucleotides 5' to 3'. The lagging strand is built in Okazaki fragments.",
  "Newton's second law states F = m·a — force equals mass times acceleration. The newton (N) is defined as kg·m/s². Newton's third law: every action has an equal and opposite reaction.",
  "The speed of light in vacuum c = 299,792,458 m/s is the universal speed limit, per special relativity. Einstein's E = mc² relates rest energy to rest mass.",
];

module.exports = {
  extractText() {
    return Promise.resolve({ pages: PLACEHOLDER_PAGES });
  },
};
