/**
 * Verificação funcional do ChupaSocial contra o projeto Supabase real.
 * Usa a chave service_role apenas localmente para criar/remover usuários de teste.
 * Nunca é executado no deploy.
 *
 * Uso: node scripts/verify.mjs
 * Requer SUPABASE_URL, SUPABASE_ANON_KEY e SUPABASE_SERVICE_ROLE_KEY no ambiente.
 */
import { createClient } from "@supabase/supabase-js";

const URL = process.env.SUPABASE_URL;
const ANON = process.env.SUPABASE_ANON_KEY;
const SERVICE = process.env.SUPABASE_SERVICE_ROLE_KEY;

if (!URL || !ANON || !SERVICE) {
  console.error("Faltam variáveis de ambiente para o teste.");
  process.exit(2);
}

const admin = createClient(URL, SERVICE, {
  auth: { autoRefreshToken: false, persistSession: false },
});

const results = [];
let failures = 0;

function check(name, condition, detail = "") {
  const ok = Boolean(condition);
  if (!ok) failures += 1;
  results.push({ name, ok, detail });
  console.log(`${ok ? "PASS" : "FAIL"}  ${name}${ok ? "" : `  → ${detail}`}`);
}

function client() {
  return createClient(URL, ANON, {
    auth: { autoRefreshToken: false, persistSession: false },
  });
}

const run = Date.now().toString(36);
const password = `Chupa!${run}Aa1`;
const suffix = run.slice(-6);
const users = {
  a: { email: `qa.a.${run}@example.com`, username: `qa_a_${suffix}`, display: "QA Ana" },
  b: { email: `qa.b.${run}@example.com`, username: `qa_b_${suffix}`, display: "QA Bruno" },
  c: { email: `qa.c.${run}@example.com`, username: `qa_c_${suffix}`, display: "QA Caio" },
};

const created = [];
const uploads = [];

async function createUser(spec) {
  const { data, error } = await admin.auth.admin.createUser({
    email: spec.email,
    password,
    email_confirm: true,
    user_metadata: { username: spec.username, display_name: spec.display },
  });
  if (error) throw new Error(`createUser ${spec.email}: ${error.message}`);
  created.push(data.user.id);
  return data.user.id;
}

async function signIn(spec) {
  const supabase = client();
  const { error } = await supabase.auth.signInWithPassword({
    email: spec.email,
    password,
  });
  if (error) throw new Error(`signIn ${spec.email}: ${error.message}`);
  return supabase;
}

// PNG mínimo válido (1x1)
const pngBytes = Uint8Array.from(
  Buffer.from(
    "iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mP8z8BQDwAEhQGAhKmMIQAAAABJRU5ErkJggg==",
    "base64",
  ),
);

try {
  // ---------------------------------------------------------------- cadastro
  const idA = await createUser(users.a);
  const idB = await createUser(users.b);
  const idC = await createUser(users.c);
  check("cadastro cria usuário + perfil automático", Boolean(idA && idB && idC));

  const { data: profileA } = await admin.from("profiles").select("*").eq("id", idA).single();
  check(
    "trigger cria perfil com username e nome",
    profileA?.username === users.a.username && profileA?.display_name === users.a.display,
    JSON.stringify(profileA),
  );

  const duplicate = await admin.auth.admin.createUser({
    email: `qa.dup.${run}@example.com`,
    password,
    email_confirm: true,
    user_metadata: { username: users.a.username, display_name: "Duplicado" },
  });
  check("username único é imposto no cadastro", Boolean(duplicate.error), duplicate.error?.message);

  const a = await signIn(users.a);
  const b = await signIn(users.b);
  const c = await signIn(users.c);
  check("login com senha funciona", true);

  // ------------------------------------------------------------ publicações
  const { data: postA, error: postError } = await a
    .from("posts")
    .insert({ author_id: idA, content: `Primeira publicação de teste ${run}` })
    .select("id")
    .single();
  check("publica texto", Boolean(postA?.id), postError?.message);

  const uploadPath = `${idA}/qa-${run}.png`;
  const { error: uploadError } = await a.storage.from("post-media").upload(uploadPath, pngBytes, {
    contentType: "image/png",
  });
  if (!uploadError) uploads.push(uploadPath);
  check("upload de mídia na própria pasta", !uploadError, uploadError?.message);

  const publicUrl = a.storage.from("post-media").getPublicUrl(uploadPath).data.publicUrl;

  const { data: postMedia, error: mediaError } = await a
    .from("post_media")
    .insert({ post_id: postA.id, storage_path: uploadPath, public_url: publicUrl, position: 0 })
    .select("id")
    .single();
  check("anexa imagem à publicação", Boolean(postMedia?.id), mediaError?.message);

  const { error: wrongFolder } = await b.storage
    .from("post-media")
    .upload(`${idA}/invasao-${run}.png`, pngBytes, { contentType: "image/png" });
  check("storage bloqueia upload na pasta de outra pessoa", Boolean(wrongFolder), "upload indevido passou");

  const { data: bView } = await b.from("posts").select("id").eq("id", postA.id).maybeSingle();
  check("outra conta lê publicação pública", bView?.id === postA.id);

  // ---------------------------------------------------------- curtir/notif.
  const { error: likeError } = await b.from("likes").insert({ post_id: postA.id, user_id: idB });
  check("curtir publicação", !likeError, likeError?.message);

  const { count: likeCount } = await a
    .from("likes")
    .select("*", { count: "exact", head: true })
    .eq("post_id", postA.id);
  check("contagem de curtidas visível", likeCount === 1, `count=${likeCount}`);

  const { data: likeNotif } = await a
    .from("notifications")
    .select("id, type, actor_id")
    .eq("user_id", idA)
    .eq("type", "like")
    .eq("post_id", postA.id);
  check(
    "notificação de curtida criada pelo trigger",
    likeNotif?.length === 1 && likeNotif[0].actor_id === idB,
    JSON.stringify(likeNotif),
  );

  const { error: spoofLike } = await b
    .from("likes")
    .insert({ post_id: postA.id, user_id: idA });
  check("não é possível curtir em nome de outra conta", Boolean(spoofLike));

  // ------------------------------------------------------------- comentários
  const { data: comment, error: commentError } = await b
    .from("comments")
    .insert({ post_id: postA.id, author_id: idB, content: "Comentário de teste" })
    .select("id")
    .single();
  check("comentar publicação", Boolean(comment?.id), commentError?.message);

  const { data: reply, error: replyError } = await a
    .from("comments")
    .insert({
      post_id: postA.id,
      author_id: idA,
      parent_id: comment.id,
      content: "Resposta de teste",
    })
    .select("id")
    .single();
  check("responder comentário", Boolean(reply?.id), replyError?.message);

  const { data: commentNotifs } = await b
    .from("notifications")
    .select("type")
    .eq("user_id", idB)
    .eq("type", "reply");
  check("notificação de resposta", (commentNotifs?.length ?? 0) >= 1);

  const { error: crossComment } = await b
    .from("comments")
    .insert({ post_id: postA.id, author_id: idA, content: "invasão" });
  check("não é possível comentar como outra pessoa", Boolean(crossComment));

  // ---------------------------------------------------------------- repost
  const { error: repostError } = await b
    .from("posts")
    .insert({ author_id: idB, repost_of: postA.id, content: "" });
  check("repostar", !repostError, repostError?.message);

  const { data: repostNotif } = await a
    .from("notifications")
    .select("id")
    .eq("user_id", idA)
    .eq("type", "repost");
  check("notificação de repost", (repostNotif?.length ?? 0) >= 1);

  // -------------------------------------------------------------- seguidores
  const { error: followError } = await a
    .from("follows")
    .insert({ follower_id: idA, following_id: idB });
  check("seguir perfil público", !followError, followError?.message);

  const { data: followNotif } = await b
    .from("notifications")
    .select("id, type")
    .eq("user_id", idB)
    .eq("type", "follow");
  check("notificação de novo seguidor", (followNotif?.length ?? 0) >= 1);

  const { error: selfFollow } = await a
    .from("follows")
    .insert({ follower_id: idA, following_id: idA });
  check("não é possível seguir a si mesmo", Boolean(selfFollow));

  // ---------------------------------------------------------- perfil privado
  await a.from("profiles").update({ is_private: true }).eq("id", idA);

  const { data: privatePost } = await a
    .from("posts")
    .insert({ author_id: idA, content: `Publicação privada ${run}` })
    .select("id")
    .single();

  const { data: cSeesPrivate } = await c
    .from("posts")
    .select("id")
    .eq("id", privatePost.id)
    .maybeSingle();
  check("RLS esconde publicação de perfil privado", cSeesPrivate === null);

  const { error: requestError } = await c
    .from("follow_requests")
    .insert({ requester_id: idC, target_id: idA });
  check("solicitação de seguir perfil privado", !requestError, requestError?.message);

  const { data: requestNotif } = await a
    .from("notifications")
    .select("id")
    .eq("user_id", idA)
    .eq("type", "follow_request");
  check("notificação de solicitação de seguir", (requestNotif?.length ?? 0) >= 1);

  const { error: acceptError } = await a.rpc("respond_follow_request", {
    p_requester: idC,
    p_accept: true,
  });
  check("aceitar solicitação de seguir", !acceptError, acceptError?.message);

  const { data: cSeesAfterAccept } = await c
    .from("posts")
    .select("id")
    .eq("id", privatePost.id)
    .maybeSingle();
  check("após aprovação, seguidor vê publicação privada", cSeesAfterAccept?.id === privatePost.id);

  const { data: cFollowRow } = await c
    .from("follows")
    .select("follower_id")
    .eq("follower_id", idC)
    .eq("following_id", idA)
    .maybeSingle();
  check("aceite cria vínculo de seguidor", Boolean(cFollowRow));

  // ---------------------------------------------------------------- mensagens
  const { data: conversationId, error: convError } = await a.rpc("get_or_create_conversation", {
    p_other: idB,
  });
  check("abrir conversa individual", Boolean(conversationId), convError?.message);

  const { data: sameConversation } = await b.rpc("get_or_create_conversation", { p_other: idA });
  check("conversa é reaproveitada (sem duplicar)", sameConversation === conversationId);

  const { error: messageError } = await a
    .from("messages")
    .insert({ conversation_id: conversationId, sender_id: idA, body: "Olá, tudo bem?" });
  check("enviar mensagem", !messageError, messageError?.message);

  const { data: bMessages } = await b
    .from("messages")
    .select("id, body")
    .eq("conversation_id", conversationId);
  check("destinatário lê o histórico", (bMessages?.length ?? 0) === 1);

  const { data: cMessages } = await c
    .from("messages")
    .select("id")
    .eq("conversation_id", conversationId);
  check("RLS isola conversa de terceiros", (cMessages?.length ?? 0) === 0);

  const { error: spyMessage } = await c
    .from("messages")
    .insert({ conversation_id: conversationId, sender_id: idC, body: "intruso" });
  check("não-membro não envia mensagem", Boolean(spyMessage));

  const { data: messageNotif } = await b
    .from("notifications")
    .select("id")
    .eq("user_id", idB)
    .eq("type", "message");
  check("notificação de mensagem", (messageNotif?.length ?? 0) >= 1);

  const { error: readReceipt } = await b
    .from("conversation_members")
    .update({ last_read_at: new Date().toISOString() })
    .eq("conversation_id", conversationId)
    .eq("user_id", idB);
  check("marcar conversa como lida", !readReceipt, readReceipt?.message);

  // -------------------------------------------------------------- comunidades
  const { data: community, error: communityError } = await a
    .from("communities")
    .insert({
      name: `Comunidade QA ${suffix}`,
      slug: `comunidade-qa-${suffix}`,
      description: "Comunidade criada pelo teste automatizado.",
      creator_id: idA,
    })
    .select("id, slug")
    .single();
  check("criar comunidade", Boolean(community?.id), communityError?.message);

  const { data: ownerRow } = await a
    .from("community_members")
    .select("role")
    .eq("community_id", community.id)
    .eq("user_id", idA)
    .maybeSingle();
  check("criador entra como dono", ownerRow?.role === "owner");

  const { error: joinError } = await b
    .from("community_members")
    .insert({ community_id: community.id, user_id: idB, role: "member" });
  check("entrar em comunidade", !joinError, joinError?.message);

  const { error: communityPostError } = await b
    .from("posts")
    .insert({ author_id: idB, community_id: community.id, content: "Post na comunidade" })
    .select("id")
    .single();
  check("membro publica na comunidade", !communityPostError, communityPostError?.message);

  const { error: outsiderPostError } = await c
    .from("posts")
    .insert({ author_id: idC, community_id: community.id, content: "Fora da comunidade" });
  check("não-membro não publica na comunidade", Boolean(outsiderPostError));

  const { error: promoteError } = await a
    .from("community_members")
    .update({ role: "moderator" })
    .eq("community_id", community.id)
    .eq("user_id", idB);
  check("dono promove moderador", !promoteError, promoteError?.message);

  const { data: outsiderPromote } = await c
    .from("community_members")
    .update({ role: "moderator" })
    .eq("community_id", community.id)
    .eq("user_id", idC)
    .select("role");
  check("terceiro não altera papéis", (outsiderPromote?.length ?? 0) === 0, JSON.stringify(outsiderPromote));

  await c.from("community_members").insert({
    community_id: community.id,
    user_id: idC,
    role: "member",
  });
  const { data: selfPromote } = await c
    .from("community_members")
    .update({ role: "moderator" })
    .eq("community_id", community.id)
    .eq("user_id", idC)
    .select("role");
  check("membro não se autopromove", (selfPromote?.length ?? 0) === 0, JSON.stringify(selfPromote));

  const { data: ownerTry } = await b
    .from("community_members")
    .update({ role: "owner" })
    .eq("community_id", community.id)
    .eq("user_id", idB)
    .select("role");
  check("moderador não se torna dono", (ownerTry?.length ?? 0) === 0, JSON.stringify(ownerTry));

  const { data: searchHit } = await b
    .from("communities")
    .select("id")
    .ilike("name", `%QA ${suffix}%`);
  check("busca de comunidades", (searchHit?.length ?? 0) >= 1);

  const { data: postSearch } = await b
    .from("posts")
    .select("id")
    .ilike("content", "%Post na comunidade%");
  check("busca de publicações", (postSearch?.length ?? 0) >= 1);

  // ------------------------------------------------------------ autorizações
  const { data: deleteForeignData, error: deleteForeignError } = await b
    .from("posts")
    .delete()
    .eq("id", postA.id)
    .select("id");
  const { data: stillThere } = await a
    .from("posts")
    .select("id")
    .eq("id", postA.id)
    .maybeSingle();
  check(
    "não é possível excluir publicação de outra pessoa",
    Boolean(deleteForeignError) || (deleteForeignData?.length ?? 0) === 0,
    `deleted=${JSON.stringify(deleteForeignData)}`,
  );
  check("publicação de terceiro permanece intacta", stillThere?.id === postA.id);

  const { error: spoofPost } = await b
    .from("posts")
    .insert({ author_id: idA, content: "publicando como outra pessoa" });
  check("RLS bloqueia publicação em nome de outra conta", Boolean(spoofPost));

  const { error: editForeign } = await b
    .from("profiles")
    .update({ bio: "alterada por terceiro" })
    .eq("id", idA);
  const { data: profileAfter } = await admin
    .from("profiles")
    .select("bio")
    .eq("id", idA)
    .single();
  check("RLS bloqueia edição de perfil alheio", profileAfter?.bio !== "alterada por terceiro");

  const { error: selfRole } = await c
    .from("community_members")
    .insert({ community_id: community.id, user_id: idC, role: "owner" });
  check("não é possível entrar já como dono", Boolean(selfRole));

  // ---------------------------------------------------------- exclusão própria
  const { data: disposable } = await b
    .from("posts")
    .insert({ author_id: idB, content: `Para excluir ${run}` })
    .select("id")
    .single();
  const { error: deleteOwn } = await b.from("posts").delete().eq("id", disposable.id);
  check("excluir a própria publicação", !deleteOwn, deleteOwn?.message);

  // --------------------------------------------------------------- notificações
  const { error: readAll } = await a.rpc("mark_notifications_read");
  check("marcar notificações como lidas", !readAll, readAll?.message);

  const { data: unreadLeft } = await a
    .from("notifications")
    .select("id")
    .eq("user_id", idA)
    .is("read_at", null);
  check("todas as notificações ficam lidas", (unreadLeft?.length ?? 0) === 0);

  // ---------------------------------------------------------- perfil/estatística
  const { data: stats } = await a.rpc("profile_stats", { p_user: idA });
  check(
    "estatísticas de perfil via RPC",
    Array.isArray(stats) && stats.length === 1 && Number(stats[0].followers) >= 1,
    JSON.stringify(stats),
  );

  const { data: available } = await client().rpc("is_username_available", {
    p_username: users.b.username,
  });
  check("checagem de username disponível", available === false);
} catch (error) {
  failures += 1;
  console.error("ERRO FATAL:", error.message);
} finally {
  // limpeza
  for (const path of uploads) {
    await admin.storage.from("post-media").remove([path]).catch(() => {});
  }
  for (const id of created) {
    await admin.auth.admin.deleteUser(id).catch(() => {});
  }

  console.log("\n----------------------------------------");
  console.log(`${results.length - failures}/${results.length} verificações passaram`);
  process.exit(failures === 0 ? 0 : 1);
}
