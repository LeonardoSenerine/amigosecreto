# Amigo secreto da família

Aplicação React para o sorteio da família, com perfis, fotos, listas de desejos e confirmação antes de revelar o resultado.

## Executar localmente

```sh
npm install
npm run dev
```

## Supabase

O app usa Supabase Auth, Postgres e Storage. A migração inicial está em `supabase/migrations/20261015000000_family_draw.sql`.

O projeto inclui a URL e a chave `publishable` pública como padrão, então funciona na Vercel sem variáveis adicionais. Se necessário, `VITE_SUPABASE_URL` e `VITE_SUPABASE_PUBLISHABLE_KEY` em `.env.local` podem sobrescrever esses valores. Use somente a chave publishable no frontend; nunca use nem publique uma chave `secret` ou `service_role`.

No Supabase Auth, a confirmação de e-mail fica desativada porque cada participante entra pelo nome e usa um e-mail interno. A recuperação por e-mail não está disponível; se alguém esquecer a senha, o organizador precisará redefinir a conta. O primeiro acesso reivindica o nome escolhido, sem validação externa de identidade.

O sorteio é criado uma única vez no banco, sob lock transacional. Cada participante aparece uma vez como destinatário, ninguém tira a si mesmo e cada pessoa autenticada só consegue ler o próprio resultado. Desejos e avatares seguem políticas de acesso por participante.
