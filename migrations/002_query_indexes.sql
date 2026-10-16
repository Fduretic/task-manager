-- Additive migration: speeds board ordering and invitation/session maintenance without changing data.
CREATE INDEX tasks_created_at ON tasks(created_at DESC);
CREATE INDEX invitations_expiry ON invitations(expires_at) WHERE accepted_at IS NULL;
CREATE INDEX invitations_inviter ON invitations(inviter_id);
CREATE INDEX sessions_user ON sessions(user_id);
CREATE INDEX rate_limits_expiry ON rate_limits(reset_at);
