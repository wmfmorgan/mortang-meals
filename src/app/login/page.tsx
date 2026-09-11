import { PageHeader } from "@/components/page-header";
import { LoginForm } from "./login-form";

export default function LoginPage() {
  return (
    <div>
      <PageHeader
        eyebrow="Account"
        title="Sign in"
        lede="Invite-only. We'll email a magic link if this address can sign in."
      />
      <LoginForm />
    </div>
  );
}
