import { auth } from "@/auth";
import { redirect } from "next/navigation";
import { getAllUserProgress, getAllFeedback, TOTAL_TOPICS } from "@/lib/tableStorage";
import AdminDashboard from "./AdminDashboard";

export default async function AdminPage() {
  const session = await auth();
  const adminEmail = process.env.ADMIN_EMAIL;

  if (
    !session?.user?.email ||
    !adminEmail ||
    session.user.email.toLowerCase() !== adminEmail.toLowerCase()
  ) {
    redirect("/");
  }

  const [users, feedback] = await Promise.all([getAllUserProgress(), getAllFeedback()]);

  return <AdminDashboard users={users} totalTopics={TOTAL_TOPICS} feedback={feedback} />;
}
