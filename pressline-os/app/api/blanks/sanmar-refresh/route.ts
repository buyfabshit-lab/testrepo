import { json, staffRoute } from "@/lib/api";
import { fetchAndRefresh } from "@/lib/sanmar";
export const dynamic = "force-dynamic";
export const maxDuration = 300;
export const POST = staffRoute(["owner", "production"], async () => json(await fetchAndRefresh()));
