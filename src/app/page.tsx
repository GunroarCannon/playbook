import App from "@/components/App";
import Login from "@/components/Login";
import { currentUser } from "@/lib/auth";

export default async function Page() {
  const user = await currentUser();
  return user ? <App /> : <Login />;
}
