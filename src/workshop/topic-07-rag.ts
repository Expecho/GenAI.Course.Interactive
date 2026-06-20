/**
 * Topic 7 — "Retrieval (RAG)". Two code blocks:
 *  - default (broken): ask about private/internal info the model can't know; it
 *    confidently makes something up (hallucination).
 *  - fixed: proper RAG — embed the documents and the question, rank by cosine
 *    similarity, inject the best match as context, and answer from it.
 *
 * `embeddingDeployment` is injected (defaults to text-embedding-3-large).
 */
export const topic07DefaultCode = `// Ask about something only WE know — a fictional company's internal policy.
const question = "How much paid time off do people get when they join Northwind?";

const res = await client.responses.create({
  model: deployment,
  input: question,
});

return res; // it can't know our policy — watch it guess (and sound confident)
`;

export const topic07RagCode = `// A tiny "knowledge base". In a real app these come from a search / vector DB.
const documents = [
  "Northwind HR handbook: New employees receive 22 vacation days in their first year, rising to 27 after five years.",
  "Northwind expenses policy: meals while travelling are reimbursed up to 40 EUR per day.",
  "Northwind IT: laptops are replaced every three years on request.",
];

const question = "How much paid time off do people get when they join Northwind?";

// 1) EMBED — turn each document and the question into a vector (a list of numbers
//    that captures meaning). Real systems precompute and store the doc vectors.
const docVectors = (
  await client.embeddings.create({ model: embeddingDeployment, input: documents })
).data.map((d) => d.embedding);

const queryVector = (
  await client.embeddings.create({ model: embeddingDeployment, input: question })
).data[0].embedding;

// 2) RETRIEVE — rank documents by cosine similarity to the question (closer
//    meaning = higher score), then keep the best match. Note the question shares
//    almost no words with the doc — embeddings match on *meaning*, not keywords.
function cosine(a, b) {
  let dot = 0, na = 0, nb = 0;
  for (let i = 0; i < a.length; i++) {
    dot += a[i] * b[i];
    na += a[i] * a[i];
    nb += b[i] * b[i];
  }
  return dot / (Math.sqrt(na) * Math.sqrt(nb));
}

const ranked = documents
  .map((doc, i) => ({ doc, score: cosine(queryVector, docVectors[i]) }))
  .sort((a, b) => b.score - a.score);

ranked.forEach((r) => console.log(r.score.toFixed(3) + "  " + r.doc.slice(0, 45) + "…"));

const top = ranked.slice(0, 1).map((r) => r.doc);

// 3) AUGMENT + GENERATE — inject the best match and answer from it.
const res = await client.responses.create({
  model: deployment,
  input: [
    {
      role: "system",
      content:
        "Answer ONLY using the provided context. If it is not in the context, say you do not know.\\n\\nContext:\\n" +
        top.join("\\n"),
    },
    { role: "user", content: question },
  ],
});

return res; // grounded in the retrieved document
`;
