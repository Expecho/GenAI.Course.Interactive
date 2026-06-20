/**
 * Topic 5 — "Structured output". Two code blocks:
 *  - default (broken): ask for JSON in the prompt; the reply is often wrapped in
 *    markdown fences or varies, so JSON.parse can't be trusted.
 *  - fixed: attach a JSON schema via `text.format` (strict) so the model must
 *    return valid JSON in exactly that shape.
 */
export const topic05DefaultCode = `// We want DATA, not prose. Let's just ask for JSON and try to use it.
const res = await client.responses.create({
  model: deployment,
  input: 'Extract the name and age, and reply as JSON: "Sam is 30 years old."',
});

console.log("Raw output:\\n" + res.output_text);

// Try to use the reply as data:
try {
  const data = JSON.parse(res.output_text);
  console.log("Parsed → name: " + data.name + ", age: " + data.age);
} catch (err) {
  console.log("JSON.parse failed: " + err.message);
}

return res; // the Answer shows the raw text — often fenced or inconsistent
`;

export const topic05SchemaCode = `// Attach a JSON schema. With strict:true the model MUST return valid JSON
// in exactly this shape — the right fields and types, nothing extra.
const res = await client.responses.create({
  model: deployment,
  input: 'Extract the name and age from: "Sam is 30 years old."',
  text: {
    format: {
      type: "json_schema",
      name: "person",
      schema: {
        type: "object",
        properties: {
          name: { type: "string" },
          age: { type: "integer" },
        },
        required: ["name", "age"],
        additionalProperties: false,
      },
      strict: true,
    },
  },
});

// Guaranteed valid JSON matching the schema — safe to parse and use.
const person = JSON.parse(res.output_text);
console.log("name: " + person.name + " | age: " + person.age + " (" + typeof person.age + ")");

return res; // the Answer shows clean, schema-shaped JSON
`;
