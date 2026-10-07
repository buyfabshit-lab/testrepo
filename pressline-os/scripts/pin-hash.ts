/** Usage: npm run pin:hash -- 4821   → prints OFFICE_PIN_HASH value for Railway. Never commit the output. */
import { scryptSync, randomBytes } from "node:crypto";
const pin = process.argv[2];
if (!pin || !/^\d{4,8}$/.test(pin)) { console.error("usage: npm run pin:hash -- <4-8 digit pin>"); process.exit(1); }
const salt = randomBytes(16).toString("hex");
console.log(`scrypt$${salt}$${scryptSync(pin, Buffer.from(salt, "hex"), 32).toString("hex")}`);
