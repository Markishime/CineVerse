import { redirect } from "next/navigation";

/** CineVerse is free for everyone with no account — old sign-up links go home. */
export default function SignupPage() {
  redirect("/");
}
