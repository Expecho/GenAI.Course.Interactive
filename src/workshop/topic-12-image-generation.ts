/**
 * Topic 12 — "Image generation". A single code block: generate an image from a
 * text prompt with an image model and render it via the injected `showImage`.
 * `imageDeployment` is injected (env AZURE_OPENAI_IMAGE_DEPLOYMENT, default
 * gpt-image-1) — an image model must be deployed in the Foundry resource.
 */
export const topic12DefaultCode = `// Image models turn a text prompt into a picture (not text).
const res = await client.images.generate({
  model: imageDeployment,
  prompt: "A friendly robot reading a book under a tree, flat vector illustration",
  size: "1024x1024",
});

// Image models return the picture as base64 (no text "answer"). Render it:
showImage(res.data[0].b64_json);

console.log("usage: " + JSON.stringify(res.usage));
`;
