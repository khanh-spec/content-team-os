import { LoginForm } from "./login-form";

export default async function LoginPage({ searchParams }: PageProps<"/login">) {
  const { error } = await searchParams;
  const message =
    error === "domain"
      ? "This email domain is not allowed to access the workspace."
      : error
        ? "Sign-in link was invalid or expired. Request a new one."
        : null;
  return <LoginForm initialError={message} />;
}
