/**
 * Topic 16 (file order) — "Skills", displayed as Topic 13. A single code block:
 * a skill registry where the model first sees only cheap name+description
 * metadata, picks the relevant skill, and only THEN loads its full instructions
 * into context (progressive disclosure — ties to context windows).
 */
export const topic16DefaultCode = `// A "skill" = packaged, reusable expertise: a name, a short description, and the
// full instructions (and, in real systems, bundled files/scripts too).
const skills = {
  "pirate-speak": {
    description: "Rewrite the user's text in over-the-top pirate dialect.",
    instructions: "You are a salty pirate. Rewrite the user's message in heavy pirate dialect — 'arr', 'matey', 'ye', 'be', nautical flavour — keeping the meaning.",
  },
  "haiku": {
    description: "Turn the user's text into a haiku.",
    instructions: "Rewrite the user's message as a haiku: three lines of 5, 7, 5 syllables. Output only the haiku.",
  },
  "formal-email": {
    description: "Rewrite casual text as a polite formal email.",
    instructions: "Rewrite the user's message as a concise, polite formal business email with a greeting and a sign-off.",
  },
};

const request = "make this sound like a pirate: the meeting is at noon";

// 1) PROGRESSIVE DISCLOSURE — the model only sees a cheap menu (names +
//    one-line descriptions), NOT every skill's full instructions.
const menu = Object.entries(skills).map(([name, s]) => "- " + name + ": " + s.description).join("\\n");
const pick = await client.responses.create({
  model: deployment,
  input: "Available skills:\\n" + menu + "\\n\\nWhich ONE skill best fits this request?\\nRequest: " + request,
  text: { format: { type: "json_schema", name: "pick",
    schema: { type: "object", properties: { skill: { type: "string", enum: Object.keys(skills) } }, required: ["skill"], additionalProperties: false },
    strict: true } },
});
const chosen = JSON.parse(pick.output_text).skill;
console.log("Model loaded the skill: " + chosen);

// 2) Only NOW do we load the chosen skill's full instructions into context.
const res = await client.responses.create({
  model: deployment,
  input: [
    { role: "system", content: skills[chosen].instructions },
    { role: "user", content: request },
  ],
});

return res; // produced by the on-demand-loaded skill
`;
