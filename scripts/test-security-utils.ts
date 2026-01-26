import { hashPin, verifyPin } from "../server/utils/security";

async function runTests() {
  console.log("Running security utils tests...");

  let passed = 0;
  let failed = 0;

  function assert(condition: boolean, message: string) {
    if (condition) {
      console.log(`✅ ${message}`);
      passed++;
    } else {
      console.error(`❌ ${message}`);
      failed++;
    }
  }

  // Test 1: Hashing
  const pin = "1234";
  const hash = await hashPin(pin);
  assert(hash.startsWith("SCRYPT:"), "Hash starts with SCRYPT:");
  assert(hash.split(":").length === 3, "Hash has 3 parts (prefix, salt, key)");

  // Test 2: Verify correct pin
  const isValid = await verifyPin(pin, hash);
  assert(isValid, "Verifies correct PIN");

  // Test 3: Verify incorrect pin
  const isInvalid = await verifyPin("wrong", hash);
  assert(!isInvalid, "Rejects incorrect PIN");

  // Test 4: Verify legacy plaintext
  const isLegacyInvalid = await verifyPin(pin, pin);
  assert(!isLegacyInvalid, "Rejects legacy plaintext PIN as invalid hash format");

  // Test 5: Verify invalid hash format
  const isGarbageInvalid = await verifyPin(pin, "garbage");
  assert(!isGarbageInvalid, "Rejects garbage hash");

  console.log(`\nTests completed. Passed: ${passed}, Failed: ${failed}`);
  if (failed > 0) {
    process.exit(1);
  }
}

runTests().catch(console.error);
