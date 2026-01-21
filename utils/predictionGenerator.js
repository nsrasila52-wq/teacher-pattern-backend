function getProbabilityTag(probabilityPercent) {
  if (probabilityPercent >= 6) {
    return "High";
  } else if (probabilityPercent >= 3) {
    return "Medium";
  } else {
    return "Low";
  }
}

function generatePredictionSentence(prediction) {
  if (!prediction) return "";

  const {
    topic,
    appearedCount,
    totalPapers,
    probabilityPercent
  } = prediction;

  if (!topic || probabilityPercent === undefined) return "";

  const probabilityTag = getProbabilityTag(probabilityPercent);

  return `Based on analysis of last ${totalPapers} papers, ${topic} appeared ${appearedCount} times and has a ${probabilityTag.toLowerCase()} probability (${probabilityPercent}%) of appearing again.`;
}

module.exports = generatePredictionSentence;
