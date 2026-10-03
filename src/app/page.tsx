import App from "@/components/App";
import Landing from "@/components/Landing";
import { currentUser } from "@/lib/auth";

export default async function Page() {
  const user = await currentUser();
  return user ? <App /> : <Landing signedIn={false} />;
}
