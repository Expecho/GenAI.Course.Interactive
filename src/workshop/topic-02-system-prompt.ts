/**
 * Default editable code for Topic 2 — "System & user prompts".
 *
 * Shows a conversation as a list of role-tagged messages: a *system* prompt that
 * sets the assistant's style (here: overly happy) plus a *user* prompt with the
 * actual request. The code returns the response so the steps below can show it.
 */
export const topic02DefaultCode = `// A conversation is a list of messages. The *system* prompt sets the behaviour
// and style; the *user* prompt is the actual request.
const res = await client.responses.create({
  model: deployment,
  input: [
    {
      role: "system",
      content:
        "You are an overly happy, bubbly assistant. Reply with boundless " +
        "enthusiasm, lots of exclamation marks and emoji!",
    },
    { role: "user", content: "What is the outcome of 4 times 4?" },
  ],
});

return res;
`;
