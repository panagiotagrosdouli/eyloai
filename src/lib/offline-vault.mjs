const encoder = new TextEncoder(),
  decoder = new TextDecoder();
const b64 = (bytes) => btoa(String.fromCharCode(...bytes));
const unb64 = (text) => Uint8Array.from(atob(text), (c) => c.charCodeAt(0));
export const OFFLINE_PREFIX = "eylo:offline:v1:";
export function validateOfflineSnapshot(snapshot) {
  if (
    !snapshot ||
    typeof snapshot.owner_id !== "string" ||
    !snapshot.owner_id ||
    !Array.isArray(snapshot.notes) ||
    !Array.isArray(snapshot.projects) ||
    snapshot.notes.length > 500 ||
    snapshot.projects.length > 100 ||
    [...snapshot.notes, ...snapshot.projects].some(
      (row) => row.user_id !== snapshot.owner_id,
    )
  )
    throw new Error("Offline snapshot ownership or coverage is invalid.");
  if (encoder.encode(JSON.stringify(snapshot)).length > 1048576)
    throw new Error("Offline snapshots are limited to 1 MiB.");
  return snapshot;
}
async function keyFor(passphrase, salt) {
  if (
    typeof passphrase !== "string" ||
    passphrase.length < 12 ||
    passphrase.length > 200
  )
    throw new Error("Use an offline passphrase between 12 and 200 characters.");
  const material = await crypto.subtle.importKey(
    "raw",
    encoder.encode(passphrase),
    "PBKDF2",
    false,
    ["deriveKey"],
  );
  return crypto.subtle.deriveKey(
    { name: "PBKDF2", salt, iterations: 210000, hash: "SHA-256" },
    material,
    { name: "AES-GCM", length: 256 },
    false,
    ["encrypt", "decrypt"],
  );
}
export async function encryptOfflineSnapshot(snapshot, passphrase) {
  validateOfflineSnapshot(snapshot);
  const salt = crypto.getRandomValues(new Uint8Array(16)),
    iv = crypto.getRandomValues(new Uint8Array(12)),
    key = await keyFor(passphrase, salt),
    aad = encoder.encode(snapshot.owner_id);
  const encrypted = new Uint8Array(
    await crypto.subtle.encrypt(
      { name: "AES-GCM", iv, additionalData: aad },
      key,
      encoder.encode(JSON.stringify(snapshot)),
    ),
  );
  let ciphertext = "";
  for (let i = 0; i < encrypted.length; i += 8192)
    ciphertext += String.fromCharCode(...encrypted.slice(i, i + 8192));
  return {
    version: 1,
    owner_id: snapshot.owner_id,
    salt: b64(salt),
    iv: b64(iv),
    ciphertext: btoa(ciphertext),
  };
}
export async function decryptOfflineSnapshot(vault, passphrase) {
  if (
    vault?.version !== 1 ||
    typeof vault.owner_id !== "string" ||
    typeof vault.ciphertext !== "string" ||
    vault.ciphertext.length > 1500000
  )
    throw new Error("Unsupported offline vault.");
  try {
    const salt = unb64(vault.salt),
      iv = unb64(vault.iv);
    if (salt.length !== 16 || iv.length !== 12)
      throw new Error("Invalid vault");
    const key = await keyFor(passphrase, salt);
    const plain = await crypto.subtle.decrypt(
      { name: "AES-GCM", iv, additionalData: encoder.encode(vault.owner_id) },
      key,
      unb64(vault.ciphertext),
    );
    const snapshot = validateOfflineSnapshot(JSON.parse(decoder.decode(plain)));
    if (snapshot.owner_id !== vault.owner_id)
      throw new Error("Ownership mismatch");
    return snapshot;
  } catch {
    throw new Error(
      "Offline unlock failed. Check the passphrase and vault integrity.",
    );
  }
}
export function clearOfflineVaults(storage) {
  for (let i = storage.length - 1; i >= 0; i--) {
    const key = storage.key(i);
    if (key?.startsWith(OFFLINE_PREFIX)) storage.removeItem(key);
  }
}
