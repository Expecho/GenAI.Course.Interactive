/**
 * Topic 6 — "Multimodal". A single code block: send an image alongside a text
 * question and let the vision-capable chat model describe what it sees.
 * The image URL is on a host the model service can fetch.
 */
export const topic06DefaultCode = `// Multimodal models accept more than text. Here we send an IMAGE alongside a
// question, and the model describes what it sees.
const res = await client.responses.create({
  model: deployment,
  input: [
    {
      role: "user",
      content: [
        { type: "input_text", text: "What is in this image? Describe it in one sentence." },
        { type: "input_image", image_url: "https://www.gstatic.com/webp/gallery/1.jpg" },
      ],
    },
  ],
});

// Notice how many input tokens an image costs (compare with a text-only call).
console.log("usage:", JSON.stringify(res.usage, null, 2));

return res;
`;
