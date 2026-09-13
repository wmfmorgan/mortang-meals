import { redirect } from "next/navigation";

/** Manual add lives inline on /meals now. */
export default function NewRecipePage() {
  redirect("/meals");
}
