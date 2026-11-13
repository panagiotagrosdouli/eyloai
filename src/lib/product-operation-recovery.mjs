export const PRODUCT_OPERATION_PREFIX = "eylo:product-operation:";
const uuid = (value) =>
  typeof value === "string" &&
  /^[a-f0-9]{8}(?:-[a-f0-9]{4}){3}-[a-f0-9]{12}$/i.test(value);
export async function pendingProductOperation(
  storage,
  ownerId,
  projectId,
  tool,
  record,
) {
  if (
    !uuid(ownerId) ||
    !uuid(projectId) ||
    !uuid(record?.id) ||
    !["workflows", "studio", "conferences"].includes(tool)
  )
    throw new Error("Invalid operation identity.");
  const digest = Array.from(
    new Uint8Array(
      await crypto.subtle.digest(
        "SHA-256",
        new TextEncoder().encode(JSON.stringify(record)),
      ),
    ),
    (b) => b.toString(16).padStart(2, "0"),
  ).join("");
  const key = `${PRODUCT_OPERATION_PREFIX}${ownerId}:${projectId}:${tool}:${record.id}`;
  let prior;
  try {
    const raw = storage.getItem(key);
    if (raw) prior = JSON.parse(raw);
  } catch {
    throw new Error(
      "Pending operation metadata cannot be read. Review confirmed results before clearing it.",
    );
  }
  if (prior) {
    if (!uuid(prior.id) || prior.digest !== digest)
      throw new Error(
        "A previous operation is pending for a different draft. Review confirmed results before clearing the pending operation.",
      );
    return { ...prior, key };
  }
  const created = { id: crypto.randomUUID(), digest };
  try {
    storage.setItem(key, JSON.stringify(created));
  } catch {
    throw new Error(
      "This action needs browser-tab recovery storage to protect retries.",
    );
  }
  return { ...created, key };
}
export function verifyProductOperationResult(tool, operation, result) {
  if (!result || result.id !== operation.id)
    throw new Error("The server did not confirm this operation identity.");
  if (
    tool === "workflows" &&
    (!Array.isArray(result.task_ids) ||
      !result.task_ids.length ||
      result.task_ids.length > 20 ||
      result.task_ids.some((id) => !uuid(id)))
  )
    throw new Error("The server did not confirm the created tasks.");
  if (tool !== "workflows" && result.tool !== tool)
    throw new Error("The server confirmed a different action.");
  return result;
}
