import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { AppShell } from "@/components/app-shell";
import { NotificationList } from "@/components/notification-list";
import { fetchNotifications } from "@/lib/queries";
import { createClient } from "@/lib/supabase/server";

export const metadata: Metadata = { title: "Notificações" };

export default async function NotificationsPage() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect("/login?next=/notifications");

  const items = await fetchNotifications(user.id);

  return (
    <AppShell>
      <div className="sticky top-[57px] z-20 border-b border-line bg-bg/90 px-4 py-3 backdrop-blur sm:px-5 lg:top-0">
        <h1 className="text-base font-semibold">Notificações</h1>
      </div>
      <NotificationList initialItems={items} viewerId={user.id} />
    </AppShell>
  );
}
