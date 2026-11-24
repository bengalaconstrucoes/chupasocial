import { createClient } from "@supabase/supabase-js";

const URL = process.env.SUPABASE_URL;
const SERVICE = process.env.SUPABASE_SERVICE_ROLE_KEY;
const admin = createClient(URL, SERVICE, { auth: { autoRefreshToken: false, persistSession: false } });

const PASSWORD = "ChupaTeste#2026";
const emails = ["ana.chupa.teste@example.com", "bruno.chupa.teste@example.com"];

if (process.argv.includes("--cleanup")) {
  const { data } = await admin.auth.admin.listUsers({ perPage: 200 });
  for (const user of data.users.filter((u) => emails.includes(u.email))) {
    await admin.auth.admin.deleteUser(user.id);
    console.log("removido", user.email);
  }
  process.exit(0);
}

const specs = [
  { email: emails[0], username: "ana_teste", display_name: "Ana Teste" },
  { email: emails[1], username: "bruno_teste", display_name: "Bruno Teste" },
];

for (const spec of specs) {
  const { data, error } = await admin.auth.admin.createUser({
    email: spec.email,
    password: PASSWORD,
    email_confirm: true,
    user_metadata: { username: spec.username, display_name: spec.display_name },
  });
  console.log(spec.username, error ? `erro: ${error.message}` : `ok ${data.user.id}`);
}
console.log("senha:", PASSWORD);
