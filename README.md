# Aquário IoT — Monitoramento & Telemetria

Dashboard responsivo em React, TypeScript e Vite para leituras da tabela `public.leituras_aquario` no Supabase.

## Executar localmente

1. Instale as dependências: `npm install`
2. Edite `.env` e informe a chave anon pública do projeto em `VITE_SUPABASE_ANON_KEY`.
3. Inicie o dashboard: `npm run dev`

O URL do projeto já está configurado em `.env`. Sem a chave anon, o dashboard abre em modo demonstração, identificado na interface; nenhuma amostra de demonstração é enviada ao banco.

## Sincronização

As leituras são ordenadas pelo `created_at` original. O dashboard consulta a tabela na abertura e ao trocar o período, recebe `INSERT` pelo Supabase Realtime e consulta novamente a cada cinco segundos como fallback. Para habilitar o fluxo em tempo real, inclua `public.leituras_aquario` na publicação Realtime do projeto e permita `SELECT` pela política RLS apropriada.

Os toggles de iluminação, oxigenação e alimentação registram ações apenas na interface. A tabela disponível contém telemetria e não fornece um endpoint de comando para os atuadores.
# aquario
