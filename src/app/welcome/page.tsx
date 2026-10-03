import type { Metadata } from "next";
import Landing from "@/components/Landing";
import { currentUser } from "@/lib/auth";

export const metadata: Metadata = {
  title: "Playbook: test your what-if ideas on a workbench that remembers you",
};

/** The landing page, reachable when signed in too (linked from settings). */
export default async function Welcome() {
  const user = await currentUser();
  return <Landing signedIn={!!user} />;
}
