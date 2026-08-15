-- Tape Lounge shared Supabase hardening. Re-runnable snapshot.

-- 이전에 수동 설치됐던 public SECURITY DEFINER 이벤트 트리거는 제거합니다.
-- 각 스키마 파일에서 RLS와 grant를 명시하므로 자동 DDL 훅이 필요하지 않습니다.
drop event trigger if exists ensure_rls;
drop function if exists public.rls_auto_enable();

-- 새 객체가 PUBLIC/클라이언트 역할에 자동 노출되지 않게 기본 권한을 잠급니다.
alter default privileges for role postgres in schema public
  revoke select, insert, update, delete, truncate, references, trigger on tables from anon, authenticated;
alter default privileges for role postgres in schema public
  revoke execute on functions from public, anon, authenticated;
alter default privileges for role postgres in schema public
  revoke usage, select on sequences from anon, authenticated;

-- 현재 객체도 스키마별 SQL에서 명시한 최소 권한만 남깁니다.
revoke all on public.salon_board from anon, authenticated;
revoke all on function public.board_monotonic() from public, anon, authenticated;
revoke all on function public.limit_salon_chat_rate() from public, anon, authenticated;
