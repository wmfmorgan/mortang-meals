import { PageHeader } from "@/components/page-header";
import { requirePageUser } from "@/lib/request-auth";
import { JoinForm } from "./join-form";

export default async function JoinPage({
  searchParams,
}: {
  searchParams: Promise<{ code?: string }>;
}) {
  await requirePageUser();
  const params = await searchParams;
  const initialCode =
    typeof params.code === "string" ? params.code.trim().toUpperCase() : "";

  return (
    <div>
      <PageHeader
        eyebrow="Household"
        title="Join a household"
        lede="Enter the invite code someone shared with you. You’ll share their Plans, Meals, and shopping list."
      />
      <JoinForm initialCode={initialCode} />
    </div>
  );
}
