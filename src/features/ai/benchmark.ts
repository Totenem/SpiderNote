export function words(text: string) {
  return text
    .normalize("NFKC")
    .toLocaleLowerCase()
    .replace(/[^\p{L}\p{N}\s]/gu, " ")
    .split(/\s+/)
    .filter(Boolean);
}
export function wordErrorRate(reference: string, hypothesis: string) {
  const expected = words(reference);
  const actual = words(hypothesis);
  if (expected.length > 10000 || actual.length > 10000)
    throw Error("Benchmark text is too long to score safely.");
  let row = Array.from({ length: actual.length + 1 }, (_, index) => index);
  for (let i = 1; i <= expected.length; i++) {
    const next = [i];
    for (let j = 1; j <= actual.length; j++)
      next[j] = Math.min(
        row[j] + 1,
        next[j - 1] + 1,
        row[j - 1] + (expected[i - 1] === actual[j - 1] ? 0 : 1),
      );
    row = next;
  }
  const errors = row[actual.length];
  return {
    errors,
    referenceWords: expected.length,
    hypothesisWords: actual.length,
    wer: expected.length ? errors / expected.length : actual.length ? null : 0,
  };
}
export const TEXT_FIXTURES = [
  {
    id: "meeting-en-1",
    language: "English",
    text: "Maya will send the budget proposal on Friday. The launch has been postponed to June 12. We have not selected a venue yet. The team approved a budget of 5000 pesos.",
    facts: [
      "Maya will send the budget proposal on Friday",
      "The launch has been postponed to June 12",
      "We have not selected a venue yet",
      "5000 pesos",
    ],
  },
  {
    id: "study-fil-1",
    language: "Filipino",
    text: "Ang photosynthesis ay proseso kung saan ginagamit ng halaman ang liwanag upang gumawa ng pagkain. Kailangan nito ng tubig at carbon dioxide. Oxygen ang isa sa mga produktong inilalabas nito. Balikan ang paksang ito bago ang pagsusulit sa Lunes.",
    facts: ["photosynthesis", "tubig at carbon dioxide", "Oxygen", "Lunes"],
  },
  {
    id: "meeting-taglish-1",
    language: "Taglish",
    text: "Si Bea ang magse-send ng revised design bukas. Hindi pa approved ang extra budget. Ang deadline ng prototype ay November 15. We need to test on a phone with 4 GB RAM. Wala pang assigned owner para sa testing.",
    facts: [
      "Bea",
      "Hindi pa approved ang extra budget",
      "November 15",
      "4 GB RAM",
      "Wala pang assigned owner",
    ],
  },
] as const;
export function coverage(
  referenceFacts: readonly string[],
  passages: readonly { quote: string }[],
) {
  const output = words(passages.map((item) => item.quote).join(" ")).join(" ");
  const present = referenceFacts.map((fact) =>
    output.includes(words(fact).join(" ")),
  );
  return {
    matched: present.filter(Boolean).length,
    total: present.length,
    coverage: present.filter(Boolean).length / present.length,
    missingIndices: present.flatMap((found, index) => (found ? [] : [index])),
  };
}
export const JFK_REFERENCE =
  "And so my fellow Americans ask not what your country can do for you ask what you can do for your country";
