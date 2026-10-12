-- The RLS auto-enable event trigger is not an application RPC endpoint.
-- Keep the event trigger installed, but prevent API roles from invoking its
-- SECURITY DEFINER function directly through PostgREST.
DO $$
BEGIN
  IF to_regprocedure('public.rls_auto_enable()') IS NOT NULL THEN
    EXECUTE 'REVOKE EXECUTE ON FUNCTION public.rls_auto_enable() FROM anon, authenticated, public, service_role';
  END IF;
END
$$;
