function categorizeQuestionTypes(questionLines = []) {
  const categories = {
    MCQ: [],
    "Numerical / Calculation": [],
    "Proof / Reasoning": [],
    "Theory / Definition": [],
    "Graph / Diagram": []
  };

  questionLines.forEach(q => {
    const text = q.toLowerCase();

    if (
      text.includes("which of the following") ||
      text.includes("(a)") ||
      text.includes("(b)") ||
      text.includes("option")
    ) {
      categories.MCQ.push(q);
    }
    else if (
      text.includes("calculate") ||
      text.includes("find the value") ||
      text.includes("solve") ||
      text.includes("maximum") ||
      text.includes("minimum")
    ) {
      categories["Numerical / Calculation"].push(q);
    }
    else if (
      text.includes("prove") ||
      text.includes("show that") ||
      text.includes("justify")
    ) {
      categories["Proof / Reasoning"].push(q);
    }
    else if (
      text.includes("define") ||
      text.includes("explain") ||
      text.includes("what is")
    ) {
      categories["Theory / Definition"].push(q);
    }
    else if (
      text.includes("graph") ||
      text.includes("diagram") ||
      text.includes("figure")
    ) {
      categories["Graph / Diagram"].push(q);
    }
  });

  // remove empty categories
  Object.keys(categories).forEach(key => {
    if (categories[key].length === 0) delete categories[key];
  });

  return categories;
}

module.exports = categorizeQuestionTypes;
