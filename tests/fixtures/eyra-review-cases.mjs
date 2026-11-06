// Synthetic and independently labelled *examples*, not a scientific gold set.
// Human reviewers must replace or extend these before claiming field accuracy.
export const EVIDENCE_REVIEW_CASES = [
  {
    id: 'benefit-observed', domain: 'medicine', expected_supported: true,
    title: 'Illustrative fall prevention trial',
    abstract: 'Among 200 randomized participants, the intervention group reported 12 falls and the control group reported 19 falls during follow-up.',
    claim: 'The intervention group reported 12 falls compared with 19 in the control group.',
  },
  {
    id: 'negation-reversed', domain: 'medicine', expected_supported: false,
    title: 'Illustrative negative trial',
    abstract: 'The intervention did not significantly improve survival compared with control during the six-month observation period.',
    claim: 'The intervention significantly improved survival compared with control.',
  },
  {
    id: 'causal-leap', domain: 'public health', expected_supported: false,
    title: 'Illustrative observational cohort',
    abstract: 'In this observational cohort, device use was associated with better self-reported sleep, but causality could not be established.',
    claim: 'Using the device causes better sleep.',
  },
  {
    id: 'no-calibration', domain: 'AI', expected_supported: false,
    title: 'Illustrative trajectory prediction study',
    abstract: 'We evaluated average displacement error and final displacement error. Probability calibration was not evaluated in this study.',
    claim: 'The model demonstrated well-calibrated predictive probabilities.',
  },
  {
    id: 'context-feature', domain: 'transport', expected_supported: true,
    title: 'Illustrative roadside sensing study',
    abstract: 'The trajectory predictor used traffic light state and neighboring road-user velocity as input features.',
    claim: 'The predictor used traffic light state as an input feature.',
  },
  {
    id: 'generalization-overreach', domain: 'AI', expected_supported: false,
    title: 'Illustrative single-city experiment',
    abstract: 'The model was evaluated in one city with no external test dataset and no cross-domain validation.',
    claim: 'The model generalizes robustly across multiple cities and datasets.',
  },
  {
    id: 'ablation-invented', domain: 'AI', expected_supported: false,
    title: 'Illustrative attention model report',
    abstract: 'The paper reports accuracy and memory use for an attention-based model but did not perform ablation studies.',
    claim: 'An ablation proved attention contributed the largest performance improvement.',
  },
  {
    id: 'cross-dataset-experiment', domain: 'AI', expected_supported: true,
    title: 'Illustrative transfer study',
    abstract: 'We evaluated transfer from dataset A to dataset B and observed a larger error on B than the source-domain test set.',
    claim: 'Cross-dataset transfer from A to B was evaluated.',
  },
  {
    id: 'subset-inflation', domain: 'climate', expected_supported: false,
    title: 'Illustrative coastal survey',
    abstract: 'We inspected 40 coastal cities selected from one region, without sampling cities outside that region.',
    claim: 'The analysis covers all coastal cities worldwide.',
  },
  {
    id: 'sampling-confirmed', domain: 'transport', expected_supported: true,
    title: 'Illustrative movement study',
    abstract: 'All sequences were resampled at three hertz before training, with each track segmented into observation and prediction windows.',
    claim: 'The trajectory observations were resampled to 3 Hz.',
  },
  {
    id: 'latency-misquoted', domain: 'AI', expected_supported: false,
    title: 'Illustrative CPU latency benchmark',
    abstract: 'Median batch-one CPU inference latency was 250 milliseconds, measured without image preprocessing time.',
    claim: 'The end-to-end pipeline completed in 25 milliseconds on CPU.',
  },
  {
    id: 'novelty-overclaim', domain: 'research review', expected_supported: false,
    title: 'Illustrative limited literature review',
    abstract: 'We reviewed twelve selected articles and found relatively few evaluations of uncertainty-aware trajectory prediction.',
    claim: 'No previous publication has evaluated uncertainty-aware trajectory prediction.',
  },
];
