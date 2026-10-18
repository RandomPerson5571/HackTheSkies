// Validate the provider envelope before accessing an untrusted JSON response.
export async function readCompletion(response: Response) {
  const body: unknown = await response.json();
  if (
    !body ||
    typeof body !== "object" ||
    !("choices" in body) ||
    !Array.isArray(body.choices)
  )
    throw new Error("Invalid completion response");
  const choice: unknown = body.choices[0];
  if (!choice || typeof choice !== "object" || !("message" in choice))
    throw new Error("Missing completion");
  const message = choice.message;
  if (
    !message ||
    typeof message !== "object" ||
    !("content" in message) ||
    typeof message.content !== "string"
  )
    throw new Error("Missing completion content");
  return {
    content: message.content,
    finishReason: "finish_reason" in choice ? choice.finish_reason : undefined,
  };
}
