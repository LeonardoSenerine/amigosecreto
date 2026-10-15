# Amigo secreto da família

Aplicação React para o sorteio da família, com perfis, fotos, listas de desejos e confirmação antes de revelar o resultado.

## Executar localmente

```sh
npm install
npm run dev
```

## Dados e autenticação

O Supabase ainda não está conectado. Nesta versão, fotos, desejos, sorteio e hashes de senha ficam no armazenamento local do navegador e não sincronizam entre dispositivos.

No primeiro acesso, o cadastro é feito selecionando um nome e criando uma senha. Como não há uma confirmação externa de identidade, outra pessoa pode cadastrar esse nome antes do participante correto. Para uso compartilhado, conecte o Supabase Auth, o banco de dados e o Storage antes de distribuir o app.
