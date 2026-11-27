-- =============================================================================
-- ChupaSocial — 0013 — Menções (@usuario) nas notificações
-- Precisa rodar separada: um valor novo de enum não pode ser usado na mesma
-- transação em que é criado.
-- =============================================================================

alter type public.notification_type add value if not exists 'mention';
