import { cookies } from "next/headers";
import RoomFrame from "@/components/world/RoomFrame";
import PinWall from "@/components/world/PinWall";
import { officeDesk } from "@/components/world/data";
import { OFFICE_COOKIE, verifyOfficeToken } from "@/lib/auth/pin";

export const dynamic = "force-dynamic";

/** Business Office — PIN wall. Reads nothing until the `pl_office` cookie verifies. */
export default async function OfficePage() {
  const jar = await cookies();
  const unlocked = verifyOfficeToken(jar.get(OFFICE_COOKIE)?.value);
  const desk = unlocked ? await officeDesk() : { quotes: [], pos: [] };
  return (
    <RoomFrame slug="office" aside={<span className={`badge border ${unlocked ? "border-[#16a34a] text-[#16a34a]" : "border-mf-blood text-mf-blood"}`}>{unlocked ? "Unlocked" : "Locked"}</span>}>
      {!unlocked && (
        <p className="mb-6 max-w-xl text-sm text-mf-muted">
          Approvals only happen behind this wall. The tablet checks the PIN server-side; a good PIN opens the door for eight hours on this device.
        </p>
      )}
      <PinWall unlocked={unlocked} quotes={desk.quotes} pos={desk.pos} />
    </RoomFrame>
  );
}
