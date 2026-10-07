import type { Metadata } from "next";
import { VaultSearch } from "@/components/board/VaultSearch";
import { PageHeader } from "@/components/ui/Card";

export const metadata: Metadata = { title: "Vault" };

export default function VaultPage() {
  return (
    <>
      <PageHeader title="The Vault" subtitle="MCG art is house-product only. Customer art stays with the customer. Camo is free for all." />
      <VaultSearch />
    </>
  );
}
